'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { parseCsv, splitCompanyNames } from '@/lib/csv'
import { revalidatePath } from 'next/cache'
import { PRODUCT_CATEGORY_ALIASES } from '@/lib/products/categories'

const CATALOGUE_ROLES = ['admin', 'sales'] as const
const IMAGE_BUCKET = 'product-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

function publicImageUrl(objectPath: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return objectPath
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${IMAGE_BUCKET}/${objectPath.replace(/^\/+/, '')}`
}

export type ImportFailure = { row: number; sku: string; reason: string }

export type ImportSummary = {
  total: number
  imported: number
  skipped: number
  failed: number
  failures: ImportFailure[]
}

function cell(row: Record<string, string>, key: string) {
  return (row[key] || '').trim()
}

function parseAccess(raw: string, companyNames: string[], isAdmin: boolean): 'all' | 'selected' | 'none' {
  if (!isAdmin) return 'all'
  const value = raw.toLowerCase()
  if (value === 'none' || value === 'internal' || value === 'internal_only' || value === 'hidden') return 'none'
  if (value === 'selected' || value === 'specific' || value === 'personalized' || companyNames.length > 0) {
    if (value === 'all' || value === 'global' || value === 'catalogue') return 'all'
    return 'selected'
  }
  if (value === 'all' || value === 'global' || value === 'catalogue' || value === '') return 'all'
  return 'all'
}

export async function importCatalogueCsv(formData: FormData): Promise<ImportSummary | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!CATALOGUE_ROLES.includes(profile.role as (typeof CATALOGUE_ROLES)[number])) {
    return { error: 'Not permitted to import products' }
  }

  const file = formData.get('csv')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file to import' }
  if (file.size > 2 * 1024 * 1024) return { error: 'CSV must be 2 MB or smaller' }

  let mapping: Record<string, string> = {}
  try {
    mapping = JSON.parse(String(formData.get('mapping') || '{}')) as Record<string, string>
  } catch {
    return { error: 'Column mapping is invalid' }
  }

  const text = await file.text()
  const table = parseCsv(text)
  if (table.headers.length === 0) return { error: 'The CSV file is empty' }

  const headerIndex = new Map(table.headers.map((h, i) => [h, i]))
  const mappedRows = table.rows.map((cells) => {
    const row: Record<string, string> = {}
    for (const [field, header] of Object.entries(mapping)) {
      if (!header) continue
      const idx = headerIndex.get(header)
      row[field] = idx === undefined ? '' : (cells[idx] || '')
    }
    return row
  })

  const supabase = await createClient()
  const [{ data: categories }, { data: suppliers }, { data: companies }, { data: existingProducts }] = await Promise.all([
    supabase.from('categories').select('id, name'),
    supabase.from('suppliers').select('id, name'),
    supabase.from('companies').select('id, name'),
    supabase.from('products').select('sku'),
  ])

  const categoryByName = new Map((categories || []).map((c) => [c.name.trim().toLowerCase(), c.id]))
  for (const [alias, canonical] of Object.entries(PRODUCT_CATEGORY_ALIASES)) {
    const id = categoryByName.get(canonical.toLowerCase())
    if (id && !categoryByName.has(alias)) categoryByName.set(alias, id)
  }
  const supplierByName = new Map((suppliers || []).map((s) => [s.name.trim().toLowerCase(), s.id]))
  const companyByName = new Map((companies || []).map((c) => [c.name.trim().toLowerCase(), c.id]))
  const existingSkus = new Set((existingProducts || []).map((p) => p.sku.trim().toUpperCase()))
  const batchSkus = new Set<string>()

  const imageFiles = formData.getAll('images').filter((item): item is File => item instanceof File && item.size > 0)
  const imageByName = new Map(imageFiles.map((img) => [img.name.trim().toLowerCase(), img]))

  type Prepared = {
    rowNumber: number
    name: string
    sku: string
    description: string | null
    category_id: string | null
    supplier_id: string | null
    price: number
    supplier_cost: number | null
    moq: number
    hsn_code: string | null
    image_url: string | null
    imageFile: File | null
    catalogue_access: 'all' | 'selected' | 'none'
    companyIds: string[]
    colour: string | null
    size: string | null
    gender: string | null
    material: string | null
    variant_sku: string | null
    extra_price: number
    status: string
  }

  const prepared: Prepared[] = []
  const failures: ImportFailure[] = []
  let skipped = 0

  mappedRows.forEach((row, index) => {
    const rowNumber = index + 2
    const name = cell(row, 'name')
    const sku = cell(row, 'sku').toUpperCase()
    if (!name && !sku) {
      skipped += 1
      return
    }
    if (!name || !sku) {
      failures.push({ row: rowNumber, sku: sku || '—', reason: 'Product name and SKU are required' })
      return
    }
    if (existingSkus.has(sku) || batchSkus.has(sku)) {
      failures.push({ row: rowNumber, sku, reason: 'SKU already exists' })
      return
    }
    const price = Number(cell(row, 'price'))
    if (!Number.isFinite(price) || price < 0) {
      failures.push({ row: rowNumber, sku, reason: 'Price must be a number 0 or greater' })
      return
    }
    const companyNames = splitCompanyNames(cell(row, 'companies'))
    const companyIds: string[] = []
    for (const companyName of companyNames) {
      const id = companyByName.get(companyName.toLowerCase())
      if (!id) {
        failures.push({ row: rowNumber, sku, reason: `Company not found: ${companyName}` })
        return
      }
      companyIds.push(id)
    }
    const catalogue_access = parseAccess(cell(row, 'catalogue_access'), companyNames, profile.role === 'admin')
    if (catalogue_access === 'selected' && companyIds.length === 0) {
      failures.push({ row: rowNumber, sku, reason: 'Selected visibility requires at least one company' })
      return
    }

    const categoryName = cell(row, 'category')
    const supplierName = cell(row, 'supplier')
    const category_id = categoryName ? categoryByName.get(categoryName.toLowerCase()) || null : null
    if (categoryName && !category_id) {
      failures.push({ row: rowNumber, sku, reason: `Category not found: ${categoryName}` })
      return
    }
    const supplier_id = supplierName ? supplierByName.get(supplierName.toLowerCase()) || null : null
    if (supplierName && !supplier_id) {
      failures.push({ row: rowNumber, sku, reason: `Supplier not found: ${supplierName}` })
      return
    }
    const imageFilename = cell(row, 'image_filename').toLowerCase()
    const imageUrl = cell(row, 'image_url')
    const matchedFile = imageFilename ? imageByName.get(imageFilename) || null : null
    if (imageFilename && !matchedFile && !imageUrl) {
      failures.push({ row: rowNumber, sku, reason: `No uploaded image matched filename ${cell(row, 'image_filename')}` })
      return
    }
    if (matchedFile && (matchedFile.size > MAX_IMAGE_BYTES || !ALLOWED_IMAGE_TYPES[matchedFile.type])) {
      failures.push({ row: rowNumber, sku, reason: 'Image must be PNG, JPG or WebP under 5 MB' })
      return
    }
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      failures.push({ row: rowNumber, sku, reason: 'image_url must be an http(s) URL' })
      return
    }

    const statusRaw = cell(row, 'status').toLowerCase() || 'active'
    const status = ['active', 'inactive', 'discontinued'].includes(statusRaw) ? statusRaw : 'active'
    const supplierCostRaw = cell(row, 'supplier_cost')
    const supplier_cost = supplierCostRaw ? Number(supplierCostRaw) : null
    if (supplierCostRaw && !Number.isFinite(supplier_cost as number)) {
      failures.push({ row: rowNumber, sku, reason: 'Supplier cost must be a number' })
      return
    }

    batchSkus.add(sku)
    prepared.push({
      rowNumber,
      name,
      sku,
      description: cell(row, 'description') || null,
      category_id,
      supplier_id,
      price,
      supplier_cost,
      moq: Math.max(1, parseInt(cell(row, 'moq') || '1', 10) || 1),
      hsn_code: cell(row, 'hsn_code') || null,
      image_url: imageUrl || null,
      imageFile: matchedFile,
      catalogue_access,
      companyIds: profile.role === 'admin' ? [...new Set(companyIds)] : [],
      colour: cell(row, 'colour') || null,
      size: cell(row, 'size') || null,
      gender: cell(row, 'gender') || null,
      material: cell(row, 'material') || null,
      variant_sku: cell(row, 'variant_sku').toUpperCase() || null,
      extra_price: Number(cell(row, 'extra_price') || '0') || 0,
      status,
    })
  })

  if (prepared.length === 0 && failures.length === 0) {
    return { error: 'No product rows found in the CSV' }
  }

  let imported = 0
  for (const item of prepared) {
    const visibility =
      item.catalogue_access === 'all'
        ? 'catalogue'
        : item.catalogue_access === 'selected'
          ? 'selected_companies'
          : 'internal_only'

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: item.name,
        sku: item.sku,
        description: item.description,
        category_id: item.category_id,
        supplier_id: item.supplier_id,
        price: item.price,
        supplier_cost: Number.isFinite(item.supplier_cost as number) ? item.supplier_cost : null,
        moq: item.moq,
        hsn_code: item.hsn_code,
        image_url: item.image_url,
        status: item.status,
        catalogue_access: item.catalogue_access,
        visibility,
      })
      .select('id')
      .single()

    if (error || !product) {
      failures.push({
        row: item.rowNumber,
        sku: item.sku,
        reason: error?.code === '23505' ? 'SKU already exists' : error?.message || 'Could not save product',
      })
      continue
    }

    if (item.catalogue_access === 'selected') {
      const { error: accessError } = await supabase.from('company_product_access').insert(
        item.companyIds.map((company_id) => ({ product_id: product.id, company_id })),
      )
      if (accessError) {
        await supabase.from('products').delete().eq('id', product.id)
        failures.push({
          row: item.rowNumber,
          sku: item.sku,
          reason: `Company visibility could not be stored: ${accessError.message}`,
        })
        continue
      }
    }

    if (item.imageFile) {
      const extension = ALLOWED_IMAGE_TYPES[item.imageFile.type]
      const objectPath = `${product.id}/${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(objectPath, item.imageFile, { contentType: item.imageFile.type, upsert: false })
      if (!uploadError) {
        await supabase
          .from('products')
          .update({ image_url: publicImageUrl(objectPath) })
          .eq('id', product.id)
      }
    }

    if (item.colour || item.size || item.gender || item.material) {
      await supabase.from('product_variants').insert({
        product_id: product.id,
        colour: item.colour,
        size: item.size,
        gender: item.gender,
        material: item.material,
        sku: item.variant_sku,
        extra_price: item.extra_price,
      })
    }

    imported += 1
    existingSkus.add(item.sku)
  }

  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')

  return {
    total: table.rows.length,
    imported,
    skipped,
    failed: failures.length,
    failures,
  }
}
