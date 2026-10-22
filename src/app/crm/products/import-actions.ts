'use server'

import { createClient } from '@/lib/supabase/server'
import { canSeeCosts, getProfile } from '@/lib/auth'
import { parseCsv, splitCompanyNames } from '@/lib/csv'
import { ignoredCostWarning, parseOptionalNumber, parseProductStatus, sideEffectWarning, type ImportNotice } from '@/lib/products/csv-import'
import { revalidatePath } from 'next/cache'
import { PRODUCT_CATEGORY_ALIASES } from '@/lib/products/categories'
import { assignCategoryId, planMissingCategories, previewImportCategories, type CategoryRef } from '@/lib/products/category-plan'
import { directOrderSchemaHint } from '@/lib/catalogue/purchase-path'
import { upsertProductCost } from '@/lib/pricing/product-costs'
import { supplierSchemaHint } from '@/lib/pricing/surfaces'
import { withIdempotency } from '@/lib/idempotency'
import { legacyPriceForInsert, resolveCsvCost } from '@/lib/products/cost-price'
import { parseCostSource, type CostSource } from '@/lib/pricing/cost-basis'
import { CHANNEL_MIGRATION, channelColumnsMissing, legacyChannelDefault, parseChannelCell } from '@/lib/products/channel-visibility'

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

export type ImportFailure = ImportNotice

export type ImportSummary = {
  total: number
  imported: number
  skipped: number
  failed: number
  warned: number
  failures: ImportFailure[]
  warnings: ImportNotice[]
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

export type CataloguePreview = {
  categories: string[]
  failures: { row: number; sku: string; reason: string }[]
}

export async function previewCatalogueCsv(formData: FormData): Promise<CataloguePreview | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!CATALOGUE_ROLES.includes(profile.role as (typeof CATALOGUE_ROLES)[number])) {
    return { error: 'Not permitted to import products' }
  }
  const file = formData.get('csv')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file to import' }
  let mapping: Record<string, string> = {}
  try {
    mapping = JSON.parse(String(formData.get('mapping') || '{}')) as Record<string, string>
  } catch {
    return { error: 'Column mapping is invalid' }
  }
  const table = parseCsv(await file.text())
  const headerIndex = new Map(table.headers.map((header, index) => [header, index]))
  const rows = table.rows.map((cells, index) => {
    const row: Record<string, string> = {}
    for (const [field, header] of Object.entries(mapping)) {
      if (!header) continue
      const idx = headerIndex.get(header)
      row[field] = idx === undefined ? '' : (cells[idx] || '')
    }
    return {
      row: index + 2,
      sku: (row.sku || '').trim().toUpperCase(),
      name: (row.name || '').trim(),
      category: (row.category || '').trim(),
      price: (row.price || '').trim(),
    }
  })
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id, name')
  return previewImportCategories({
    rows,
    existing: (categories || []) as CategoryRef[],
    createMissing: formData.get('createMissingCategories') === '1',
  })
}

export async function importCatalogueCsv(formData: FormData): Promise<ImportSummary | { error: string }> {
  return withIdempotency('crm.importCatalogueCsv', formData, () => importCatalogueCsvOnce(formData))
}

async function importCatalogueCsvOnce(formData: FormData): Promise<ImportSummary | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!CATALOGUE_ROLES.includes(profile.role as (typeof CATALOGUE_ROLES)[number])) {
    return { error: 'Not permitted to import products' }
  }
  const allowCosts = canSeeCosts(profile.role)

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

  let categoryRows: CategoryRef[] = (categories || []).map((category) => ({ id: category.id, name: category.name }))
  if (formData.get('createMissingCategories') === '1') {
    const missing = planMissingCategories(categoryRows, mappedRows.map((row) => cell(row, 'category')).filter(Boolean))
    for (const name of missing) {
      const { data, error: insertError } = await supabase.from('categories').insert({ name }).select('id, name').single()
      if (data?.id) {
        categoryRows = [...categoryRows, { id: data.id, name: data.name }]
        continue
      }
      if (insertError?.code === '23505') {
        const { data: again } = await supabase.from('categories').select('id, name')
        categoryRows = (again || []) as CategoryRef[]
        continue
      }
      if (insertError) return { error: insertError.message }
    }
  }
  const categoryByName = new Map(categoryRows.map((category) => [category.name.trim().toLowerCase(), category.id]))
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
    supplier_cost: number | null
    cost_source: CostSource | null
    moq: number
    hsn_code: string | null
    image_url: string | null
    imageFile: File | null
    catalogue_access: 'all' | 'selected' | 'none'
    show_in_store: boolean
    show_in_business: boolean
    companyIds: string[]
    colour: string | null
    size: string | null
    gender: string | null
    material: string | null
    variant_sku: string | null
    extra_price: number
    status: string
    stock_qty: number
    fulfillment_mode: 'auto' | 'buy' | 'rfq'
    internal_notes: string | null
  }

  const prepared: Prepared[] = []
  const failures: ImportFailure[] = []
  const warnings: ImportNotice[] = []
  let skipped = 0
  if (!allowCosts) {
    const costWarning = ignoredCostWarning(mappedRows)
    if (costWarning) warnings.push(costWarning)
  }

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
    // Retail and Business are admin-only, like corporate visibility. Blank keeps the legacy rule.
    const isAdmin = profile.role === 'admin'
    const storeCell = parseChannelCell(isAdmin ? cell(row, 'show_in_store') : '', catalogue_access)
    const businessCell = parseChannelCell(isAdmin ? cell(row, 'show_in_business') : '', catalogue_access)
    if (!storeCell.ok || !businessCell.ok) {
      failures.push({ row: rowNumber, sku, reason: 'Retail and Business must be yes or no' })
      return
    }

    const categoryName = cell(row, 'category')
    const supplierName = cell(row, 'supplier')
    const category_id = categoryName ? (assignCategoryId(categoryRows, categoryName) || categoryByName.get(categoryName.toLowerCase()) || null) : null
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

    const modeRaw = cell(row, 'fulfillment_mode').toLowerCase()
    const fulfillment_mode = modeRaw === 'buy' || modeRaw === 'rfq' || modeRaw === 'auto' || modeRaw === ''
      ? (modeRaw || 'auto') as 'auto' | 'buy' | 'rfq'
      : null
    if (!fulfillment_mode) {
      failures.push({ row: rowNumber, sku, reason: 'Purchase path must be auto, buy, or rfq' })
      return
    }
    const stockRaw = cell(row, 'stock_qty')
    const stock_qty = stockRaw ? Number(stockRaw) : 0
    if (!Number.isInteger(stock_qty) || stock_qty < 0 || stock_qty > 1000000) {
      failures.push({ row: rowNumber, sku, reason: 'Stock must be a whole number from 0 to 1000000' })
      return
    }

    const statusResult = parseProductStatus(cell(row, 'status'))
    if (!statusResult.ok) {
      failures.push({ row: rowNumber, sku, reason: statusResult.reason })
      return
    }
    let supplier_cost: number | null = null
    let cost_source: CostSource | null = null
    let internal_notes: string | null = null
    if (allowCosts) {
      const supplierCost = parseOptionalNumber(cell(row, 'supplier_cost'))
      if (!supplierCost.ok) {
        failures.push({ row: rowNumber, sku, reason: 'Cost price must be a number' })
        return
      }
      supplier_cost = supplierCost.value
      internal_notes = cell(row, 'internal_notes') || null
      const source = parseCostSource(cell(row, 'cost_source'))
      if (!source.ok) {
        failures.push({ row: rowNumber, sku, reason: source.error })
        return
      }
      cost_source = cell(row, 'cost_source') ? source.value : null
    }
    // Cost price is the one price on a product. An old price column is read as the cost.
    const costed = resolveCsvCost({ cost: supplier_cost, priceRaw: cell(row, 'price'), allowCosts })
    if (!costed.ok) {
      failures.push({ row: rowNumber, sku, reason: costed.reason })
      return
    }
    supplier_cost = costed.cost

    batchSkus.add(sku)
    prepared.push({
      rowNumber,
      name,
      sku,
      description: cell(row, 'description') || null,
      category_id,
      supplier_id,
      supplier_cost,
      cost_source,
      moq: Math.max(1, parseInt(cell(row, 'moq') || '1', 10) || 1),
      hsn_code: cell(row, 'hsn_code') || null,
      image_url: imageUrl || null,
      imageFile: matchedFile,
      catalogue_access,
      show_in_store: storeCell.value,
      show_in_business: businessCell.value,
      companyIds: profile.role === 'admin' ? [...new Set(companyIds)] : [],
      colour: cell(row, 'colour') || null,
      size: cell(row, 'size') || null,
      gender: cell(row, 'gender') || null,
      material: cell(row, 'material') || null,
      variant_sku: cell(row, 'variant_sku').toUpperCase() || null,
      extra_price: Number(cell(row, 'extra_price') || '0') || 0,
      status: statusResult.status,
      stock_qty,
      fulfillment_mode,
      internal_notes,
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

    const productRow: Record<string, unknown> = {
      name: item.name,
      sku: item.sku,
      description: item.description,
      category_id: item.category_id,
      supplier_id: item.supplier_id,
      // Frozen legacy column; nothing prices from it.
      price: legacyPriceForInsert(item.supplier_cost),
      moq: item.moq,
      stock_qty: item.stock_qty,
      fulfillment_mode: item.fulfillment_mode,
      hsn_code: item.hsn_code,
      image_url: item.image_url,
      status: item.status,
      catalogue_access: item.catalogue_access,
      visibility,
    }
    productRow.show_in_store = item.show_in_store
    productRow.show_in_business = item.show_in_business
    let insertResult = await supabase.from('products').insert(productRow).select('id').single()
    if (insertResult.error && channelColumnsMissing(insertResult.error.message)) {
      const legacy = legacyChannelDefault(item.catalogue_access)
      if (item.show_in_store !== legacy || item.show_in_business !== legacy) {
        failures.push({
          row: item.rowNumber,
          sku: item.sku,
          reason: `Separate Retail and Business values need ${CHANNEL_MIGRATION}`,
        })
        continue
      }
      delete productRow.show_in_store
      delete productRow.show_in_business
      insertResult = await supabase.from('products').insert(productRow).select('id').single()
    }
    const { data: product, error } = insertResult

    if (error || !product) {
      failures.push({
        row: item.rowNumber,
        sku: item.sku,
        reason: error?.code === '23505' ? 'SKU already exists' : directOrderSchemaHint(error?.message || 'Could not save product'),
      })
      continue
    }

    const costPayload: { supplier_cost?: number | null; internal_notes?: string | null; cost_source?: CostSource } = {}
    if (item.supplier_cost != null) costPayload.supplier_cost = item.supplier_cost
    if (item.cost_source && item.cost_source !== 'manual') costPayload.cost_source = item.cost_source
    if (item.internal_notes) costPayload.internal_notes = item.internal_notes
    if (Object.keys(costPayload).length > 0) {
      const { error: costError } = await upsertProductCost(supabase, product.id, costPayload)
      if (costError) {
        await supabase.from('products').delete().eq('id', product.id)
        failures.push({
          row: item.rowNumber,
          sku: item.sku,
          reason: supplierSchemaHint(costError.message),
        })
        continue
      }
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
      if (uploadError) {
        const warning = sideEffectWarning(item.rowNumber, item.sku, 'image', uploadError.message)
        if (warning) warnings.push(warning)
      } else {
        const { error: imageUpdateError } = await supabase
          .from('products')
          .update({ image_url: publicImageUrl(objectPath) })
          .eq('id', product.id)
        const warning = sideEffectWarning(item.rowNumber, item.sku, 'image', imageUpdateError?.message)
        if (warning) warnings.push(warning)
      }
    }

    if (item.colour || item.size || item.gender || item.material || item.variant_sku || item.extra_price) {
      const { error: variantError } = await supabase.from('product_variants').insert({
        product_id: product.id,
        colour: item.colour,
        size: item.size,
        gender: item.gender,
        material: item.material,
        sku: item.variant_sku,
        extra_price: item.extra_price,
      })
      const warning = sideEffectWarning(item.rowNumber, item.sku, 'variant', variantError?.message)
      if (warning) warnings.push(warning)
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
    warned: warnings.length,
    failures,
    warnings,
  }
}
