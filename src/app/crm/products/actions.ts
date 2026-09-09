'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

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
  const price = parseFloat(formData.get('price') as string) || 0
  const supplier_cost = formData.get('supplier_cost') ? parseFloat(formData.get('supplier_cost') as string) : null
  const internal_margin = formData.get('internal_margin') ? parseFloat(formData.get('internal_margin') as string) : null
  const moq = parseInt(formData.get('moq') as string, 10) || 1
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

  if (!name) {
    return { error: 'Product name is required' }
  }
  if (!sku) {
    return { error: 'SKU is required' }
  }
  if (!category_id) {
    return { error: 'Please select a category' }
  }
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

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      name,
      sku: sku.trim().toUpperCase(),
      category_id,
      brand_id,
      supplier_id,
      description,
      price,
      supplier_cost,
      internal_margin,
      moq,
      image_url,
      hsn_code,
      status,
      catalogue_access,
      visibility: catalogue_access === 'all' ? 'catalogue' : (catalogue_access === 'selected' ? 'selected_companies' : 'internal_only'),
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'SKU already exists.' }
    return { error: error.message }
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
        .upload(objectPath, imageFile, { contentType: imageFile.type, upsert: false })
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
  number('price', 'price', 0)
  number('supplier_cost')
  number('internal_margin')
  number('moq', 'moq', 1)

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
    return { error: error.message }
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
  revalidatePath('/crm/campaigns')
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
    .upload(objectPath, file, { contentType: file.type, upsert: false })
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

export async function saveCatalogueVisibility(productId: string, mode: string, companyIds: string[]) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!VISIBILITY_ROLES.includes(profile.role as (typeof VISIBILITY_ROLES)[number])) {
    return { error: 'Not permitted to change catalogue visibility' }
  }
  if (!['all', 'selected', 'none'].includes(mode)) {
    return { error: 'Unable to update catalogue visibility. Please try again.' }
  }
  if (mode === 'selected' && (!companyIds || companyIds.length === 0)) {
    return { error: 'Unable to update catalogue visibility. Please try again.' }
  }

  const supabase = await createClient()
  const visibility =
    mode === 'all' ? 'catalogue' : mode === 'selected' ? 'selected_companies' : 'internal_only'

  const { error: updateError } = await supabase
    .from('products')
    .update({ catalogue_access: mode, visibility })
    .eq('id', productId)
  if (updateError) return { error: 'Unable to update catalogue visibility. Please try again.' }

  const { error: clearError } = await supabase
    .from('company_product_access')
    .delete()
    .eq('product_id', productId)
  if (clearError) return { error: 'Unable to update catalogue visibility. Please try again.' }

  if (mode === 'selected') {
    const rows = [...new Set(companyIds)].map((company_id) => ({ product_id: productId, company_id }))
    const { error: insertError } = await supabase.from('company_product_access').insert(rows)
    if (insertError) return { error: 'Unable to update catalogue visibility. Please try again.' }
  }

  await writeAudit(supabase, {
    action: 'assignment_change',
    entity: 'products',
    entityId: productId,
    next: { catalogue_access: mode, companyIds: mode === 'selected' ? companyIds : [] },
    userId: profile.id,
  })

  revalidatePath(`/crm/products/${productId}`)
  revalidatePath('/crm/products')
  revalidatePath('/portal/catalogue')
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
  const { error } = await supabase
    .from('company_product_access')
    .delete()
    .eq('product_id', productId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }

  const { data: remaining } = await supabase
    .from('company_product_access')
    .select('company_id')
    .eq('product_id', productId)
  if (!remaining?.length) {
    const { data: product } = await supabase
      .from('products')
      .select('catalogue_access')
      .eq('id', productId)
      .maybeSingle()
    if (product?.catalogue_access === 'selected') {
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
