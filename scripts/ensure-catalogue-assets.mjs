/**
 * Idempotent: upload generated catalogue photos for products with no image_url,
 * and inherit missing company logos for high-confidence matches.
 * Uses server env only. Does not overwrite existing images or logos.
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const ASSETS = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-VI-Corporate-Gifting-giffter/assets',
)


function normalizeName(name) {
  const suffixes = new Set([
    'limited', 'ltd', 'pvt', 'private', 'inc', 'incorporated', 'llc', 'llp',
    'co', 'company', 'corp', 'corporation', 'technologies', 'technology', 'tech',
    'systems', 'solutions', 'group', 'india',
  ])
  const cleaned = String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  const parts = cleaned.split(' ').filter((part) => part && !suffixes.has(part))
  return (parts.length ? parts : cleaned.split(' ')).join(' ')
}

function normalizeDomain(website) {
  if (!website) return null
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(website) ? website : `https://${website}`
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('missing env')
    process.exit(1)
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: products, error: productError } = await admin
    .from('products')
    .select('id, sku, image_url')
  if (productError) throw new Error(productError.message)

  let uploaded = 0
  let skipped = 0
  let missingAsset = 0
  for (const product of products || []) {
    if (product.image_url && String(product.image_url).trim()) {
      skipped += 1
      continue
    }
    const filePath = path.join(ASSETS, `product-${product.sku}.png`)
    if (!fs.existsSync(filePath)) {
      missingAsset += 1
      console.error('missing_file', product.sku)
      continue
    }
    const objectPath = `${product.id}/generated.png`
    const buf = fs.readFileSync(filePath)
    const { error: uploadError } = await admin.storage
      .from('product-images')
      .upload(objectPath, buf, { contentType: 'image/png', upsert: true })
    if (uploadError) {
      console.error('upload_failed', product.sku, uploadError.message)
      continue
    }
    const publicUrl = `${url.replace(/\/$/, '')}/storage/v1/object/public/product-images/${objectPath}`
    const { error: updateError } = await admin
      .from('products')
      .update({ image_url: publicUrl })
      .eq('id', product.id)
    if (updateError) {
      console.error('update_failed', product.sku, updateError.message)
      continue
    }
    uploaded += 1
  }

  const { data: companies, error: companyError } = await admin
    .from('companies')
    .select('id, name, website, logo_path')
  if (companyError) throw new Error(companyError.message)

  const withLogo = (companies || []).filter((c) => c.logo_path)
  let inherited = 0
  for (const company of companies || []) {
    if (company.logo_path) continue
    const domain = normalizeDomain(company.website)
    const name = normalizeName(company.name)
    const match =
      (domain && withLogo.find((other) => other.id !== company.id && normalizeDomain(other.website) === domain)) ||
      (name.length >= 3 && withLogo.find((other) => other.id !== company.id && normalizeName(other.name) === name))
    if (!match?.logo_path) continue
    const { data: blob, error: downloadError } = await admin.storage.from('company-logos').download(match.logo_path)
    if (downloadError || !blob) {
      console.error('logo_download_failed', company.name, downloadError?.message)
      continue
    }
    const ext = match.logo_path.split('.').pop() || 'png'
    const objectPath = `${company.id}/inherited-${Date.now()}.${ext}`
    const { error: uploadError } = await admin.storage
      .from('company-logos')
      .upload(objectPath, blob, { upsert: false })
    if (uploadError) {
      console.error('logo_upload_failed', company.name, uploadError.message)
      continue
    }
    const { error: updateError } = await admin
      .from('companies')
      .update({ logo_path: objectPath })
      .eq('id', company.id)
      .is('logo_path', null)
    if (updateError) {
      console.error('logo_update_failed', company.name, updateError.message)
      continue
    }
    inherited += 1
    withLogo.push({ ...company, logo_path: objectPath })
  }

  const { data: after } = await admin.from('products').select('id, image_url')
  const total = after?.length || 0
  const withImage = after?.filter((p) => p.image_url && String(p.image_url).trim()).length || 0
  console.log('PRODUCTS_UPLOADED=' + uploaded)
  console.log('PRODUCTS_SKIPPED=' + skipped)
  console.log('PRODUCTS_MISSING_ASSET=' + missingAsset)
  console.log('LOGOS_INHERITED=' + inherited)
  console.log('TOTAL_PRODUCTS=' + total)
  console.log('PRODUCTS_WITH_IMAGES=' + withImage)
  console.log('PRODUCTS_MISSING=' + (total - withImage))
}

main().catch((error) => {
  console.error('script_failed', error.message)
  process.exit(1)
})
