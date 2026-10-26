'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath as revalidateNextPath } from 'next/cache'
import { invalidatePublicCatalogue } from '@/lib/catalogue/public-read'
import { PUBLIC_STORAGE_CACHE_CONTROL } from '@/lib/storage/cache-control'

function revalidatePath(path: string, type?: 'layout' | 'page') {
  invalidatePublicCatalogue()
  revalidateNextPath(path, type)
}
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { isUuid } from '@/lib/utils'
import { upsertProductCost } from '@/lib/pricing/product-costs'
import { supplierSchemaHint } from '@/lib/pricing/surfaces'
import { directOrderSchemaHint, parseFulfillmentMode } from '@/lib/catalogue/purchase-path'
import { withIdempotency } from '@/lib/idempotency'
import { canonicalCategoryLabel, findCategory } from '@/lib/products/category-plan'
import { legacyPriceForInsert, resolveCost } from '@/lib/products/cost-price'
import { parseCostSource } from '@/lib/pricing/cost-basis'
import {
  CHANNEL_MIGRATION,
  channelColumnsMissing,
  legacyChannelDefault,
  legacyVisibilityLabel,
  parseCorporateAccess,
} from '@/lib/products/channel-visibility'

const CATALOGUE_ROLES = ['admin', 'sales'] as const
const VISIBILITY_ROLES = ['admin'] as const
type CatalogueRole = (typeof CATALOGUE_ROLES)[number]

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

export async function createProduct(formData: FormData) {
  return withIdempotency('crm.createProduct', formData, () => createProductOnce(formData))
}

async function createProductOnce(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!CATALOGUE_ROLES.includes(profile.role as CatalogueRole)) {
    return { error: 'Not permitted to create products' }
  }

  const supabase = await createClient()
  const name = ((formData.get('name') as string) || '').trim()
  const sku = ((formData.get('sku') as string) || '').trim()
  const category_id = ((formData.get('category_id') as string) || '').trim() || null
  const brand_id = (formData.get('brand_id') as string) || null
  const supplier_id = (formData.get('supplier_id') as string) || null
  const description = (formData.get('description') as string) || null
  // One number per product: the cost (supplier) price. Selling prices are calculated
  // from the effective cost in Pricing; there is no retail override.
  const priced = resolveCost(formData.get('supplier_cost'))
  const costSource = parseCostSource(formData.get('cost_source'))
  const moq = parseInt(formData.get('moq') as string, 10) || 1
  const fulfillment_mode = parseFulfillmentMode(formData.get('fulfillment_mode'))
  const stockRaw = String(formData.get('stock_qty') ?? '').trim()
  const stock_qty = stockRaw ? Number(stockRaw) : 0
  if (!Number.isInteger(stock_qty) || stock_qty < 0 || stock_qty > 1000000) {
    return { error: 'Stock must be a whole number from 0 to 1000000' }
  }
  const image_url = ((formData.get('image_url') as string) || '').trim() || null
  const hsn_code = ((formData.get('hsn_code') as string) || '').trim() || null
  const status = (formData.get('status') as string) || 'active'
  const catalogue_access =
    profile.role === 'admin' ? ((formData.get('catalogue_access') as string) || 'all') : 'all'
  const selectedCompanies = [
    ...new Set(
      (profile.role === 'admin' ? (formData.getAll('company_ids') as string[]) : []).filter(Boolean)
    ),
  ]
  // Retail and Business are independent of corporate visibility. Only admin sees the
  // switches; everyone else creates a product on every channel, as before.
  const channelForm = profile.role === 'admin' && formData.has('channel_present')
  const show_in_store = channelForm ? formData.get('show_in_store') === 'on' : true
  const show_in_business = channelForm ? formData.get('show_in_business') === 'on' : true

  if (!name) {
    return { error: 'Product name is required' }
  }
  if (!sku) {
    return { error: 'SKU is required' }
  }
  if (!category_id) {
    return { error: 'Please select a category' }
  }
  if (!priced.ok) {
    return { error: priced.error }
  }
  if (!costSource.ok) return { error: costSource.error }
  // Frozen legacy column (NOT NULL until 20261022_pricing_cost_basis.sql); nothing prices from it.
  const price = legacyPriceForInsert(priced.cost)
  const supplier_cost = priced.cost
  if (image_url && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/i.test(image_url)) {
    return { error: 'Image URLs cannot point to localhost. Upload a product photo instead.' }
  }

  const imageFile = formData.get('image')
  if (imageFile instanceof File && imageFile.size > 0) {
    if (!ALLOWED_IMAGE_TYPES[imageFile.type]) {
      return { error: 'Please upload a JPG, PNG or WebP image.' }
    }
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return { error: 'Please upload an image smaller than 5 MB.' }
    }
  }
  if (!['all', 'selected', 'none'].includes(catalogue_access)) {
    return { error: 'Invalid catalogue visibility' }
  }
  if (catalogue_access === 'selected' && selectedCompanies.length === 0) {
    return { error: 'Select at least one company for personalized catalogue access.' }
  }

  const insertRow: Record<string, unknown> = {
    name,
    sku: sku.trim().toUpperCase(),
    category_id,
    brand_id,
    supplier_id,
    description,
    price,
    moq,
    stock_qty,
    fulfillment_mode,
    sample_only: formData.get('sample_only') === 'on',
    image_url,
    hsn_code,
    status,
    catalogue_access,
    visibility: catalogue_access === 'all' ? 'catalogue' : (catalogue_access === 'selected' ? 'selected_companies' : 'internal_only'),
    show_in_store,
    show_in_business,
  }
  let inserted = await supabase.from('products').insert(insertRow).select('id').single()
  if (inserted.error && channelColumnsMissing(inserted.error.message)) {
    const legacy = legacyChannelDefault(catalogue_access)
    if (show_in_store !== legacy || show_in_business !== legacy) {
      return {
        error: `Separate Retail and Business switches need ${CHANNEL_MIGRATION}. Until it is applied, Retail and Business follow "All companies".`,
      }
    }
    delete insertRow.show_in_store
    delete insertRow.show_in_business
    inserted = await supabase.from('products').insert(insertRow).select('id').single()
  }
  if (inserted.error && /sample_only/i.test(inserted.error.message)) {
    delete insertRow.sample_only
    inserted = await supabase.from('products').insert(insertRow).select('id').single()
  }
  const product = inserted.data
  const error = inserted.error

  if (error || !product) {
    if (error?.code === '23505') return { error: 'SKU already exists.' }
    return { error: directOrderSchemaHint(error?.message || 'Product was not saved') }
  }

  {
    const { error: costError } = await upsertProductCost(supabase, product.id, {
      supplier_cost,
      ...(costSource.value !== 'portal_default' ? { cost_source: costSource.value } : {}),
    })
    if (costError) {
      await supabase.from('products').delete().eq('id', product.id)
      return { error: supplierSchemaHint(costError.message) }
    }
  }

  if (supplier_id) {
    const leadRaw = String(formData.get('lead_time_days') || '').trim()
    const lead = leadRaw ? Number(leadRaw) : null
    const { error: offerError } = await supabase.from('product_supplier_offers').insert({
      product_id: product.id,
      supplier_id,
      cost: supplier_cost,
      moq,
      lead_time_days: lead != null && Number.isInteger(lead) && lead >= 0 ? lead : null,
      in_stock: true,
      is_active: true,
      is_preferred: formData.get('is_preferred') === 'on',
    })
    if (offerError && !/product_supplier_offers/i.test(offerError.message)) {
      await supabase.from('products').delete().eq('id', product.id)
      return { error: supplierSchemaHint(offerError.message) }
    }
  }

  if (catalogue_access === 'selected') {
    const accessRows = selectedCompanies.map((cId) => ({
      product_id: product.id,
      company_id: cId,
    }))
    const { error: accessError } = await supabase.from('company_product_access').insert(accessRows)
    if (accessError) {
      await supabase.from('products').delete().eq('id', product.id)
      return { error: `Product was not saved because company visibility could not be stored: ${accessError.message}` }
    }
  }

  let imageHint = ''
  if (imageFile instanceof File && imageFile.size > 0) {
    const extension = ALLOWED_IMAGE_TYPES[imageFile.type]
    if (!extension) {
      imageHint = 'upload-failed'
    } else {
      const objectPath = `${product.id}/${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(objectPath, imageFile, { contentType: imageFile.type, upsert: false, cacheControl: PUBLIC_STORAGE_CACHE_CONTROL })
      if (uploadError) {
        imageHint = 'upload-failed'
      } else {
        const { error: imageUpdateError } = await supabase
          .from('products')
          .update({ image_url: publicImageUrl(objectPath) })
          .eq('id', product.id)
        if (imageUpdateError) imageHint = 'upload-failed'
      }
    }
  } else if (!image_url) {
    imageHint = 'needed'
  }

  const colour = ((formData.get('colour') as string) || '').trim() || null
  const size = ((formData.get('size') as string) || '').trim() || null
  const gender = ((formData.get('gender') as string) || '').trim() || null
  const material = ((formData.get('material') as string) || '').trim() || null
  if (colour || size || gender || material) {
    await supabase.from('product_variants').insert({
      product_id: product.id,
      colour,
      size,
      gender,
      material,
      sku: ((formData.get('variant_sku') as string) || '').trim().toUpperCase() || null,
      extra_price: parseFloat(String(formData.get('extra_price') || '0')) || 0,
    })
  }

  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  selectedCompanies.forEach((companyId) => revalidatePath('/crm/companies/' + companyId))
  redirect('/crm/products/' + product.id + (imageHint ? `?image=${imageHint}` : ''))
}

export async function updateProduct(productId: string, formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!CATALOGUE_ROLES.includes(profile.role as CatalogueRole)) {
    return { error: 'Not permitted to edit products' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('products')
    .select('sku')
    .eq('id', productId)
    .maybeSingle()
  if (!existing) return { error: 'Product not found' }

  // Only write fields the submitted form actually contains. Previously any field
  // missing from the form (supplier, margin) was overwritten with null on save.
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const text = (key: string, column = key) => {
    if (!formData.has(key)) return
    update[column] = (formData.get(key) as string)?.trim() || null
  }
  const number = (key: string, column = key, fallback: number | null = null) => {
    if (!formData.has(key)) return
    const raw = (formData.get(key) as string)?.trim()
    if (!raw) {
      update[column] = fallback
      return
    }
    const parsed = Number(raw)
    update[column] = Number.isFinite(parsed) ? parsed : fallback
  }

  text('name')
  text('description')
  text('image_url')
  text('category_id')
  if (formData.has('category_id') && !update.category_id) {
    return { error: 'Please select a category' }
  }
  text('brand_id')
  text('subcategory_id')
  text('supplier_id')
  text('hsn_code')
  number('moq', 'moq', 1)
  const costPatch: { supplier_cost?: number | null; cost_source?: 'portal_default' | 'manual' | 'preferred' | 'lowest' } = {}
  if (formData.has('supplier_cost')) {
    // Cost price is the one price staff enter. products.price is frozen and never written here.
    const priced = resolveCost(formData.get('supplier_cost'))
    if (!priced.ok) return { error: priced.error }
    costPatch.supplier_cost = priced.cost
  }
  if (formData.has('cost_source')) {
    const source = parseCostSource(formData.get('cost_source'))
    if (!source.ok) return { error: source.error }
    costPatch.cost_source = source.value
  }
  if (formData.has('stock_qty')) {
    const raw = String(formData.get('stock_qty') ?? '').trim()
    const stock = raw ? Number(raw) : 0
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
      return { error: 'Stock must be a whole number from 0 to 1000000' }
    }
    update.stock_qty = stock
  }
  if (formData.has('fulfillment_mode')) {
    update.fulfillment_mode = parseFulfillmentMode(formData.get('fulfillment_mode'))
  }
  if (formData.has('sample_only_present')) {
    update.sample_only = formData.get('sample_only') === 'on'
  }

  if (formData.has('status')) {
    update.status = (formData.get('status') as string) || 'active'
  }

  if (formData.has('catalogue_access')) {
    const catalogue_access = (formData.get('catalogue_access') as string) || 'all'
    if (!['all', 'selected', 'none'].includes(catalogue_access)) {
      return { error: 'Invalid catalogue visibility' }
    }
    update.catalogue_access = catalogue_access
    update.visibility =
      catalogue_access === 'all' ? 'catalogue' : catalogue_access === 'selected' ? 'selected_companies' : 'internal_only'
  }

  // SKU is the stable product identifier. It is never changed implicitly, and only
  // an admin may change it deliberately. The audit_products trigger records it.
  if (formData.has('sku')) {
    const submitted = ((formData.get('sku') as string) || '').trim().toUpperCase()
    if (submitted && submitted !== existing.sku) {
      if (profile.role !== 'admin') {
        return { error: 'Only an admin can change a product SKU' }
      }
      update.sku = submitted
    }
  }

  if (formData.has('name') && !update.name) {
    return { error: 'Product name is required' }
  }
  if (typeof update.image_url === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/i.test(update.image_url)) {
    return { error: 'Image URLs cannot point to localhost. Upload a product photo instead.' }
  }

  const { error } = await supabase.from('products').update(update).eq('id', productId)
  if (error) {
    if (error.code === '23505') return { error: 'SKU already exists.' }
    return { error: directOrderSchemaHint(error.message) }
  }

  if (Object.keys(costPatch).length > 0) {
    let { error: costError } = await upsertProductCost(supabase, productId, costPatch)
    // Before the cost-basis migration there is no cost_source column; portal default (manual) is the only behaviour then.
    if (costError && /cost_source/i.test(costError.message) && costPatch.cost_source === 'portal_default') {
      delete costPatch.cost_source
      costError = Object.keys(costPatch).length ? (await upsertProductCost(supabase, productId, costPatch)).error : null
    }
    if (costError) {
      return { error: /cost_source/i.test(costError.message) ? 'Cost source needs supabase/migrations/20261022_pricing_cost_basis.sql' : supplierSchemaHint(costError.message) }
    }
  }

  if (update.status && update.status !== 'active') {
    await hideDiscontinuedProductFromClients(supabase, productId)
  }

  revalidatePath('/crm/products/' + productId)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  return { success: true }
}

/** When a master product is discontinued, hide it from client campaign/catalogue surfaces. */
async function hideDiscontinuedProductFromClients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string
) {
  await Promise.all([
    supabase
      .from('campaign_products')
      .update({ visibility: 'unpublished' })
      .eq('product_id', productId)
      .eq('visibility', 'published'),
    supabase.from('company_product_access').delete().eq('product_id', productId),
  ])
  revalidatePath('/portal/catalogue')
  revalidatePath('/portal/shortlist')
  revalidatePath('/crm/catalogs')
}

function isStoredProductImage(url: string | null | undefined): url is string {
  return Boolean(url && url.includes(`/storage/v1/object/public/${IMAGE_BUCKET}/`))
}

function objectPathFromUrl(url: string) {
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

export async function uploadProductImage(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!CATALOGUE_ROLES.includes(profile.role as CatalogueRole)) {
    return { error: 'Not permitted to update product images' }
  }

  const productId = String(formData.get('product_id') || '')
  const file = formData.get('image')
  if (!productId) return { error: 'Unable to upload product image. Please check the file and try again.' }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Please upload a JPG, PNG or WebP image.' }
  }
  const extension = ALLOWED_IMAGE_TYPES[file.type]
  if (!extension) return { error: 'Please upload a JPG, PNG or WebP image.' }
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Please upload an image smaller than 5 MB.' }

  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('id, image_url')
    .eq('id', productId)
    .maybeSingle()
  if (!product) return { error: 'Unable to upload product image. Please check the file and try again.' }

  const objectPath = `${productId}/${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false, cacheControl: PUBLIC_STORAGE_CACHE_CONTROL })
  if (uploadError) return { error: 'Unable to upload product image. Please check the file and try again.' }

  const nextUrl = publicImageUrl(objectPath)
  const { error: updateError } = await supabase
    .from('products')
    .update({ image_url: nextUrl })
    .eq('id', productId)

  if (updateError) {
    await supabase.storage.from(IMAGE_BUCKET).remove([objectPath])
    return { error: 'Unable to upload product image. Please check the file and try again.' }
  }

  if (isStoredProductImage(product.image_url)) {
    const previous = objectPathFromUrl(product.image_url)
    if (previous && previous !== objectPath) {
      await supabase.storage.from(IMAGE_BUCKET).remove([previous])
    }
  }

  revalidatePath(`/crm/products/${productId}`)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  return { success: true }
}

export async function removeProductImage(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!CATALOGUE_ROLES.includes(profile.role as CatalogueRole)) {
    return { error: 'Not permitted to update product images' }
  }

  const productId = String(formData.get('product_id') || '')
  if (!productId) return { error: 'Unable to upload product image. Please check the file and try again.' }

  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('id, image_url')
    .eq('id', productId)
    .maybeSingle()
  if (!product) return { error: 'Unable to remove product image. Please try again.' }

  const { error } = await supabase.from('products').update({ image_url: null }).eq('id', productId)
  if (error) return { error: 'Unable to remove product image. Please try again.' }

  if (isStoredProductImage(product.image_url)) {
    const previous = objectPathFromUrl(product.image_url)
    if (previous) await supabase.storage.from(IMAGE_BUCKET).remove([previous])
  }

  revalidatePath(`/crm/products/${productId}`)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  return { success: true }
}

export type ChannelVisibilityInput = {
  store: boolean
  business: boolean
  corporate: string
  companyIds: string[]
  /** With "All companies": also delete the per-company hide rules for this product. */
  clearExclusions?: boolean
}

type ExclusionClient = Awaited<ReturnType<typeof createClient>>

/**
 * Deletes company_product_exclusions rows for one product (optionally only some
 * companies) and writes a catalogue_client_unhidden audit row per removed hide,
 * mirroring the catalogue_client_hidden shape the table trigger writes.
 */
async function clearProductExclusions(
  supabase: ExclusionClient,
  productId: string,
  userId: string,
  companyIds?: string[],
): Promise<{ error?: string; removed: string[] }> {
  if (companyIds && companyIds.length === 0) return { removed: [] }
  let query = supabase.from('company_product_exclusions').delete().eq('product_id', productId)
  if (companyIds) query = query.in('company_id', companyIds)
  const { data, error } = await query.select('company_id')
  if (error) {
    // Older databases without the exclusions table have nothing to clear.
    if (/schema cache|could not find the table|does not exist/i.test(error.message)) return { removed: [] }
    return { error: error.message, removed: [] }
  }
  const removed = (data || []).map((row) => row.company_id as string)
  if (removed.length) {
    const { data: product } = await supabase.from('products').select('sku').eq('id', productId).maybeSingle()
    for (const companyId of removed) {
      await writeAudit(supabase, {
        action: 'catalogue_client_unhidden',
        entity: 'company_product_exclusions',
        entityId: productId,
        previous: { company_id: companyId, product_id: productId, sku: product?.sku ?? null },
        userId,
      })
    }
  }
  return { removed }
}

/**
 * Saves the three independent channel switches: retail store, business portal and
 * corporate visibility (all / selected / none). Corporate never decides retail.
 */
export async function saveChannelVisibility(productId: string, input: ChannelVisibilityInput) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!VISIBILITY_ROLES.includes(profile.role as (typeof VISIBILITY_ROLES)[number])) {
    return { error: 'Only admin can change product visibility' }
  }
  if (!isUuid(productId)) return { error: 'Product not found' }
  const mode = parseCorporateAccess(input?.corporate)
  if (!mode) return { error: 'Choose a corporate visibility option' }
  const companyIds = [...new Set((input.companyIds || []).filter((id) => isUuid(id)))]
  if (mode === 'selected' && companyIds.length === 0) {
    return { error: 'Select at least one company for corporate visibility' }
  }
  const store = Boolean(input.store)
  const business = Boolean(input.business)

  const supabase = await createClient()
  const base = { catalogue_access: mode, visibility: legacyVisibilityLabel(mode) }
  let { error: updateError } = await supabase
    .from('products')
    .update({ ...base, show_in_store: store, show_in_business: business })
    .eq('id', productId)
  if (updateError && channelColumnsMissing(updateError.message)) {
    // Before the migration retail and business follow corporate "All companies".
    const legacy = legacyChannelDefault(mode)
    if (store !== legacy || business !== legacy) {
      return {
        error: `Separate Retail and Business switches need ${CHANNEL_MIGRATION}. Until it is applied, Retail and Business follow "All companies".`,
      }
    }
    ;({ error: updateError } = await supabase.from('products').update(base).eq('id', productId))
  }
  if (updateError) return { error: 'Unable to update product visibility. Please try again.' }

  const { error: clearError } = await supabase
    .from('company_product_access')
    .delete()
    .eq('product_id', productId)
  if (clearError) return { error: 'Unable to update product visibility. Please try again.' }

  if (mode === 'selected') {
    const rows = companyIds.map((company_id) => ({ product_id: productId, company_id }))
    const { error: insertError } = await supabase.from('company_product_access').insert(rows)
    if (insertError) return { error: 'Unable to update product visibility. Please try again.' }
  }

  // A hide rule beats a grant, so ticking a company in "Selected companies" must
  // also lift its hide rule; otherwise the company stays hidden while the panel
  // says it can see the product. With "All companies" the admin chooses.
  let unhidden: string[] = []
  if (mode === 'selected' || (mode === 'all' && input.clearExclusions)) {
    const cleared = await clearProductExclusions(
      supabase,
      productId,
      profile.id,
      mode === 'selected' ? companyIds : undefined,
    )
    if (cleared.error) return { error: 'Visibility saved, but the hide rules could not be cleared. Please try again.' }
    unhidden = cleared.removed
  }

  await writeAudit(supabase, {
    action: 'assignment_change',
    entity: 'products',
    entityId: productId,
    next: {
      show_in_store: store,
      show_in_business: business,
      catalogue_access: mode,
      companyIds: mode === 'selected' ? companyIds : [],
      ...(unhidden.length ? { unhiddenCompanyIds: unhidden } : {}),
    },
    userId: profile.id,
  })

  revalidatePath(`/crm/products/${productId}`)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  revalidatePath('/catalogue')
  revalidatePath('/business')
  revalidatePath('/')
  return { success: true }
}

export async function grantCompanyProductAccess(productId: string, companyId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!VISIBILITY_ROLES.includes(profile.role as (typeof VISIBILITY_ROLES)[number])) {
    return { error: 'Not permitted to change catalogue visibility' }
  }

  const supabase = await createClient()
  if (!companyId) return { error: 'Please select a company' }

  const { data: product } = await supabase
    .from('products')
    .select('id, catalogue_access, status')
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle()
  if (!product) return { error: 'Choose an active catalogue product' }

  const { error: insertError } = await supabase
    .from('company_product_access')
    .upsert({ product_id: productId, company_id: companyId }, { onConflict: 'company_id,product_id' })

  if (insertError) return { error: insertError.message }

  // Assign clears any company-scoped hide so the product is visible again.
  await supabase
    .from('company_product_exclusions')
    .delete()
    .eq('product_id', productId)
    .eq('company_id', companyId)

  if (product.catalogue_access !== 'all') {
    const { error: updateError } = await supabase
      .from('products')
      .update({ catalogue_access: 'selected', visibility: 'selected_companies' })
      .eq('id', productId)
    if (updateError) return { error: updateError.message }
  }

  revalidatePath('/crm/products/' + productId)
  revalidatePath('/crm/companies/' + companyId)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  return { success: true }
}

export async function revokeCompanyProductAccess(productId: string, companyId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!VISIBILITY_ROLES.includes(profile.role as (typeof VISIBILITY_ROLES)[number])) {
    return { error: 'Not permitted to change catalogue visibility' }
  }

  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('catalogue_access')
    .eq('id', productId)
    .maybeSingle()

  const { error } = await supabase
    .from('company_product_access')
    .delete()
    .eq('product_id', productId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }

  // Hiding a global product for one company uses exclusions (CPA alone is a no-op).
  if (product?.catalogue_access === 'all') {
    const { error: hideError } = await supabase
      .from('company_product_exclusions')
      .upsert({ product_id: productId, company_id: companyId }, { onConflict: 'company_id,product_id' })
    if (hideError) return { error: hideError.message }
  } else {
    const { data: remaining } = await supabase
      .from('company_product_access')
      .select('company_id')
      .eq('product_id', productId)
    if (!remaining?.length && product?.catalogue_access === 'selected') {
      await supabase
        .from('products')
        .update({ catalogue_access: 'none', visibility: 'internal_only' })
        .eq('id', productId)
    }
  }

  revalidatePath('/crm/products/' + productId)
  revalidatePath('/crm/companies/' + companyId)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  return { success: true }
}

/** Hide a product from one company's portal catalogue. */
export async function hideCompanyProduct(productId: string, companyId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!VISIBILITY_ROLES.includes(profile.role as (typeof VISIBILITY_ROLES)[number])) {
    return { error: 'Not permitted to change catalogue visibility' }
  }
  if (!productId || !companyId) return { error: 'Product and company are required' }

  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('id, catalogue_access, status')
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle()
  if (!product) return { error: 'Choose an active catalogue product' }

  // Hide rules only mean something for "All companies" products. For "Selected
  // companies" removing the grant is the hide; writing an exclusion as well left a
  // stale rule behind that silently hid the product again after an admin later
  // re-ticked the company or switched the product to "All companies".
  if (product.catalogue_access === 'all') {
    const { error: excludeError } = await supabase
      .from('company_product_exclusions')
      .upsert({ product_id: productId, company_id: companyId }, { onConflict: 'company_id,product_id' })
    if (excludeError) {
      if (/schema cache|could not find the table/i.test(excludeError.message)) {
        return { error: 'Catalogue exclusions are not available yet. Apply migration 20261002_company_product_exclusions, then retry.' }
      }
      return { error: excludeError.message }
    }
  }

  // For selected products, drop the grant so Hide is a single clear action.
  if (product.catalogue_access === 'selected') {
    await supabase
      .from('company_product_access')
      .delete()
      .eq('product_id', productId)
      .eq('company_id', companyId)

    const { data: remaining } = await supabase
      .from('company_product_access')
      .select('company_id')
      .eq('product_id', productId)
    if (!remaining?.length) {
      await supabase
        .from('products')
        .update({ catalogue_access: 'none', visibility: 'internal_only' })
        .eq('id', productId)
    }
  }

  revalidatePath('/crm/products/' + productId)
  revalidatePath('/crm/companies/' + companyId)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  return { success: true }
}

/** Show a previously hidden product in one company's portal catalogue. */
export async function showCompanyProduct(productId: string, companyId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!VISIBILITY_ROLES.includes(profile.role as (typeof VISIBILITY_ROLES)[number])) {
    return { error: 'Not permitted to change catalogue visibility' }
  }
  if (!productId || !companyId) return { error: 'Product and company are required' }

  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('id, catalogue_access, status')
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle()
  if (!product) return { error: 'Choose an active catalogue product' }

  await supabase
    .from('company_product_exclusions')
    .delete()
    .eq('product_id', productId)
    .eq('company_id', companyId)

  // Non-global products need an explicit grant to become visible.
  if (product.catalogue_access !== 'all') {
    const { error: insertError } = await supabase
      .from('company_product_access')
      .upsert({ product_id: productId, company_id: companyId }, { onConflict: 'company_id,product_id' })
    if (insertError) return { error: insertError.message }

    if (product.catalogue_access !== 'selected') {
      const { error: updateError } = await supabase
        .from('products')
        .update({ catalogue_access: 'selected', visibility: 'selected_companies' })
        .eq('id', productId)
      if (updateError) return { error: updateError.message }
    }
  }

  revalidatePath('/crm/products/' + productId)
  revalidatePath('/crm/companies/' + companyId)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  return { success: true }
}

/**
 * Lift one company's hide rule for a product from the product page. Only deletes
 * the exclusion; it never adds a grant, so "Selected companies" stays as chosen.
 */
export async function unhideCompanyProduct(productId: string, companyId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!VISIBILITY_ROLES.includes(profile.role as (typeof VISIBILITY_ROLES)[number])) {
    return { error: 'Only admin can change product visibility' }
  }
  if (!isUuid(productId) || !isUuid(companyId)) return { error: 'Product and company are required' }

  const supabase = await createClient()
  const cleared = await clearProductExclusions(supabase, productId, profile.id, [companyId])
  if (cleared.error) return { error: 'Unable to unhide this company. Please try again.' }

  revalidatePath('/crm/products/' + productId)
  revalidatePath('/crm/companies/' + companyId)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  return { success: true }
}

export async function removeProduct(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (profile.role !== 'admin') return { error: 'Only an admin can remove a product' }

  const productId = String(formData.get('product_id') || '')
  if (!productId) return { error: 'Product is required' }

  const supabase = await createClient()
  const { data: product } = await supabase
    .from('products')
    .select('id, name, image_url, status')
    .eq('id', productId)
    .maybeSingle()
  if (!product) return { error: 'Product not found' }

  const [
    { count: orderItems },
    { count: quotationItems },
    { count: requirementProducts },
    { count: campaignProducts },
    { count: sampleMoves },
  ] = await Promise.all([
    supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    supabase.from('quotation_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    supabase.from('requirement_products').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    supabase.from('campaign_products').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    supabase.from('sample_movements').select('id', { count: 'exact', head: true }).eq('product_id', productId),
  ])

  const hasHistory = Boolean(orderItems || quotationItems || requirementProducts || campaignProducts || sampleMoves)

  if (hasHistory) {
    const { error } = await supabase
      .from('products')
      .update({ status: 'discontinued', updated_at: new Date().toISOString() })
      .eq('id', productId)
    if (error) return { error: error.message }
    await hideDiscontinuedProductFromClients(supabase, productId)
    await writeAudit(supabase, {
      action: 'update',
      entity: 'products',
      entityId: productId,
      previous: { status: product.status },
      next: { status: 'discontinued', archived: true },
      userId: profile.id,
    })
    revalidatePath('/crm/products')
    revalidatePath(`/crm/products/${productId}`)
    revalidatePath('/portal/catalogue')
    redirect(`/crm/products/${productId}?removed=archived`)
  }

  const imageUrl = product.image_url
  const { error } = await supabase.from('products').delete().eq('id', productId)
  if (error) {
    await supabase.from('products').update({ status: 'discontinued' }).eq('id', productId)
    await hideDiscontinuedProductFromClients(supabase, productId)
    return {
      error: 'This product cannot be permanently deleted because related records still exist. It was discontinued instead.',
    }
  }

  if (isStoredProductImage(imageUrl)) {
    const { count: shared } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('image_url', imageUrl)
    if (!shared) {
      const objectPath = objectPathFromUrl(imageUrl)
      if (objectPath) await supabase.storage.from(IMAGE_BUCKET).remove([objectPath])
    }
  }

  await writeAudit(supabase, {
    action: 'delete',
    entity: 'products',
    entityId: productId,
    previous: { name: product.name },
    userId: profile.id,
  })
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
  redirect('/crm/products?removed=deleted')
}

const PRICING_ROLES = ['admin', 'sales', 'management', 'accounts']

function pricingDenied() {
  return { error: 'Not permitted to edit supplier offers' }
}

function readOffer(formData: FormData) {
  const productId = String(formData.get('product_id') || '')
  const supplierId = String(formData.get('supplier_id') || '')
  const cost = Number(formData.get('cost'))
  const moq = Number.parseInt(String(formData.get('moq') || '1'), 10)
  const leadRaw = String(formData.get('lead_time_days') || '').trim()
  const lead = leadRaw === '' ? null : Number.parseInt(leadRaw, 10)
  if (!isUuid(productId) || !isUuid(supplierId)) return { error: 'Product and supplier are required' }
  if (!Number.isFinite(cost) || cost < 0) return { error: 'Cost must be zero or more' }
  if (!Number.isInteger(moq) || moq < 1) return { error: 'MOQ must be a whole number of at least 1' }
  if (lead != null && (!Number.isInteger(lead) || lead < 0)) return { error: 'Lead time must be a whole number of days' }
  return {
    product_id: productId,
    supplier_id: supplierId,
    supplier_sku: String(formData.get('supplier_sku') || '').trim() || null,
    cost,
    moq,
    lead_time_days: lead,
    in_stock: String(formData.get('in_stock')) === 'on',
    is_active: String(formData.get('is_active') || 'on') !== 'off',
    is_preferred: String(formData.get('is_preferred')) === 'on',
  }
}

async function clearOtherPreferred(productId: string, keepId?: string) {
  const supabase = await createClient()
  let query = supabase.from('product_supplier_offers').update({ is_preferred: false }).eq('product_id', productId).eq('is_preferred', true)
  if (keepId) query = query.neq('id', keepId)
  await query
}

export async function saveSupplierOffer(formData: FormData) {
  // Creating an offer is deduped by key (and by the product + supplier unique index); updating one is idempotent already.
  if (isUuid(String(formData.get('offer_id') || ''))) return saveSupplierOfferOnce(formData)
  return withIdempotency('crm.saveSupplierOffer', formData, () => saveSupplierOfferOnce(formData))
}

async function saveSupplierOfferOnce(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!PRICING_ROLES.includes(profile.role)) return pricingDenied()
  const parsed = readOffer(formData)
  if ('error' in parsed) return parsed
  const supabase = await createClient()
  const offerId = String(formData.get('offer_id') || '')
  if (parsed.is_preferred) await clearOtherPreferred(parsed.product_id, isUuid(offerId) ? offerId : undefined)

  const payload = { ...parsed, updated_at: new Date().toISOString() }
  const result = isUuid(offerId)
    ? await supabase.from('product_supplier_offers').update(payload).eq('id', offerId).eq('product_id', parsed.product_id)
    : await supabase.from('product_supplier_offers').insert(payload)
  if (result.error) {
    if (/product_supplier_offers_product_id_supplier_id|duplicate key/i.test(result.error.message)) {
      return { error: 'That supplier is already listed on this product.' }
    }
    return { error: supplierSchemaHint(result.error.message) }
  }
  revalidatePath(`/crm/products/${parsed.product_id}`)
  return { success: true }
}

export async function deleteSupplierOffer(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!PRICING_ROLES.includes(profile.role)) return pricingDenied()
  const id = String(formData.get('offer_id') || '')
  const productId = String(formData.get('product_id') || '')
  if (!isUuid(id) || !isUuid(productId)) return { error: 'Offer not found' }
  const supabase = await createClient()
  const { error } = await supabase.from('product_supplier_offers').delete().eq('id', id).eq('product_id', productId)
  if (error) return { error: supplierSchemaHint(error.message) }
  revalidatePath(`/crm/products/${productId}`)
  return { success: true }
}

export async function createCategory(name: string): Promise<{ id: string; name: string; created: boolean } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!CATALOGUE_ROLES.includes(profile.role as CatalogueRole)) {
    return { error: 'Not permitted to create categories' }
  }
  const label = canonicalCategoryLabel(name)
  if (!label) return { error: 'Enter a category name' }

  const supabase = await createClient()
  const { data: rows, error: loadError } = await supabase.from('categories').select('id, name')
  if (loadError) return { error: loadError.message }
  const existing = findCategory(rows || [], label)
  if (existing) return { id: existing.id, name: existing.name, created: false }

  const { data, error } = await supabase.from('categories').insert({ name: label }).select('id, name').single()
  if (error) {
    if (error.code === '23505') {
      const { data: again } = await supabase.from('categories').select('id, name')
      const found = findCategory(again || [], label)
      if (found) return { id: found.id, name: found.name, created: false }
    }
    return { error: error.message }
  }
  revalidatePath('/crm/products')
  revalidatePath('/crm/products/new')
  return { id: data.id, name: data.name, created: true }
}

async function createNamedRow(
  table: 'brands' | 'suppliers',
  label: string,
  noun: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!CATALOGUE_ROLES.includes(profile.role as CatalogueRole)) {
    return { error: `Not permitted to create ${noun}s` }
  }
  const name = label.trim().replace(/\s+/g, ' ')
  if (!name) return { error: `Enter a ${noun} name` }
  const supabase = await createClient()
  const { data: rows, error: loadError } = await supabase.from(table).select('id, name')
  if (loadError) return { error: loadError.message }
  const existing = (rows || []).find((row) => row.name.trim().toLowerCase() === name.toLowerCase())
  if (existing) return { id: existing.id, name: existing.name }
  const inserted = table === 'suppliers'
    ? await supabase.from('suppliers').insert({ name, is_active: true }).select('id, name').single()
    : await supabase.from('brands').insert({ name }).select('id, name').single()
  const data = inserted.data
  const error = inserted.error
  if (error) {
    if (error.code === '23505') {
      const { data: again } = await supabase.from(table).select('id, name')
      const found = (again || []).find((row) => row.name.trim().toLowerCase() === name.toLowerCase())
      if (found) return { id: found.id, name: found.name }
    }
    return { error: error.message }
  }
  if (!data) return { error: `Could not save that ${noun}` }
  revalidatePath('/crm/products')
  revalidatePath('/crm/products/new')
  return { id: data.id, name: data.name }
}

export async function createBrand(name: string) {
  return createNamedRow('brands', name, 'brand')
}

export async function createSupplier(name: string) {
  return createNamedRow('suppliers', name, 'supplier')
}
