/**
 * Process generated images → 1200x1200 webp → upload → insert products.
 * Usage: node --env-file=.env scripts/expand-catalogue-batch.mjs [sku...]
 * If no SKUs given, processes all pending from manifest.
 */
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '..')
const MANIFEST = path.join(ROOT, 'tmp/catalogue-expand/manifest.json')
const GEN_DIR = path.join(ROOT, 'tmp/catalogue-expand/generated')
const OUT_DIR = path.join(ROOT, 'tmp/catalogue-expand/processed')
const RESULTS = path.join(ROOT, 'tmp/catalogue-expand/results.json')

const STONE = { r: 232, g: 224, b: 212, alpha: 1 }
const BUCKET = 'product-images'

function findGeneratedFile(sku) {
  const exact = path.join(GEN_DIR, `${sku}.png`)
  if (fs.existsSync(exact)) return exact
  const candidates = fs.readdirSync(GEN_DIR).filter((f) => f.includes(sku) || f.toLowerCase().includes(sku.toLowerCase()))
  if (candidates.length) return path.join(GEN_DIR, candidates.sort().at(-1))
  // Cursor GenerateImage may write elsewhere — search common asset folders
  const searchRoots = [
    GEN_DIR,
    path.join(process.env.USERPROFILE || '', '.cursor/projects/c-VI-Corporate-Gifting-giffter/assets'),
    path.join(ROOT, 'public'),
  ]
  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue
    const hit = fs.readdirSync(root).find((f) => f.includes(sku) && /\.(png|jpe?g|webp)$/i.test(f))
    if (hit) return path.join(root, hit)
  }
  return null
}

async function processImage(inputPath, outPath) {
  const img = sharp(inputPath, { failOn: 'none' })
  const meta = await img.metadata()
  // Trim near-white / near-stone margins then contain into stone canvas so product fills frame
  let pipeline = sharp(inputPath, { failOn: 'none' })
  try {
    pipeline = pipeline.trim({ threshold: 28 })
  } catch {
    // keep untrimmed
  }
  const trimmed = await pipeline.toBuffer()
  const tMeta = await sharp(trimmed).metadata()
  const maxDim = Math.max(tMeta.width || 1, tMeta.height || 1)
  // Scale so longest side is ~82% of 1200
  const target = Math.round(1200 * 0.82)
  const scale = target / maxDim
  const w = Math.max(1, Math.round((tMeta.width || 1) * scale))
  const h = Math.max(1, Math.round((tMeta.height || 1) * scale))
  const resized = await sharp(trimmed)
    .resize(w, h, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
  await sharp({
    create: { width: 1200, height: 1200, channels: 4, background: STONE },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .webp({ quality: 86 })
    .toFile(outPath)
  return { source: `${meta.width}x${meta.height}`, out: '1200x1200' }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(GEN_DIR, { recursive: true })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('missing env')
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const all = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  const filter = process.argv.slice(2)
  const items = filter.length ? all.filter((p) => filter.includes(p.sku)) : all

  let results = []
  if (fs.existsSync(RESULTS)) {
    try { results = JSON.parse(fs.readFileSync(RESULTS, 'utf8')) } catch { results = [] }
  }
  const done = new Set(results.filter((r) => r.ok).map((r) => r.sku))

  const { data: existing } = await admin.from('products').select('sku, name')
  const existingSkus = new Set((existing || []).map((p) => p.sku.toUpperCase()))
  const existingNames = new Set((existing || []).map((p) => p.name.trim().toLowerCase()))

  let uploaded = 0
  let inserted = 0
  let failed = 0
  let skipped = 0

  for (const product of items) {
    if (done.has(product.sku)) {
      skipped += 1
      continue
    }
    if (existingSkus.has(product.sku.toUpperCase())) {
      results.push({ sku: product.sku, ok: false, reason: 'sku_exists' })
      failed += 1
      continue
    }
    if (existingNames.has(product.name.trim().toLowerCase())) {
      results.push({ sku: product.sku, ok: false, reason: 'name_exists' })
      failed += 1
      continue
    }

    const src = findGeneratedFile(product.sku)
    if (!src) {
      results.push({ sku: product.sku, ok: false, reason: 'missing_image' })
      failed += 1
      console.error('missing_image', product.sku)
      continue
    }

    const outPath = path.join(OUT_DIR, `${product.sku}.webp`)
    try {
      await processImage(src, outPath)
    } catch (err) {
      results.push({ sku: product.sku, ok: false, reason: 'sharp_failed:' + err.message })
      failed += 1
      console.error('sharp_failed', product.sku, err.message)
      continue
    }

    const id = randomUUID()
    const objectPath = `${id}/studio.webp`
    const buf = fs.readFileSync(outPath)
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, buf, { contentType: 'image/webp', upsert: false })
    if (uploadError) {
      results.push({ sku: product.sku, ok: false, reason: 'upload_failed:' + uploadError.message })
      failed += 1
      console.error('upload_failed', product.sku, uploadError.message)
      continue
    }
    uploaded += 1
    const imageUrl = `${url.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${objectPath}`

    const { error: insertError } = await admin.from('products').insert({
      id,
      name: product.name,
      sku: product.sku,
      category_id: product.category_id,
      description: product.description,
      price: product.price,
      moq: product.moq,
      image_url: imageUrl,
      status: 'active',
      catalogue_access: 'all',
      visibility: 'catalogue',
    })
    if (insertError) {
      results.push({ sku: product.sku, ok: false, reason: 'insert_failed:' + insertError.message, imageUrl })
      failed += 1
      console.error('insert_failed', product.sku, insertError.message)
      continue
    }
    inserted += 1
    existingSkus.add(product.sku.toUpperCase())
    existingNames.add(product.name.trim().toLowerCase())
    results.push({ sku: product.sku, ok: true, id, imageUrl, name: product.name, category: product.category })
    console.log('ok', product.sku, product.name)
  }

  fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ uploaded, inserted, failed, skipped, total_ok: results.filter((r) => r.ok).length }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
