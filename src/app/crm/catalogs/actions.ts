'use server'

import { randomBytes, randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { shareLinkOrigin } from '@/lib/auth/request-origin'
import { sendEmail } from '@/lib/email/resend'
import { listedUnitPrice } from '@/lib/pricing/listed'
import { getCompanyMarginPercent, specialPricesForCompany } from '@/lib/pricing/server'
import { sharePath } from '@/lib/catalogs/share'
import { companyCanUseCatalog } from '@/lib/catalogs/rfq'
import { appName } from '@/lib/brand'
import { extendShareExpiry, shareExpiryIso, shareLinkGrantsAccess, shareLinkIsExpired } from '@/lib/catalogs/share-link'
import { withIdempotency } from '@/lib/idempotency'
import { duplicateCatalogName } from '@/lib/catalogs/names'
import { isUuid } from '@/lib/utils'

function schemaHint(message: string) {
  if (/catalog_assignments|catalog_share_links|cloned_from|get_shared_catalog/i.test(message)) {
    return `${message} Apply supabase/migrations/20261005_catalogs_assignments_share.sql first.`
  }
  return message
}

function revalidateCatalog(id?: string) {
  revalidatePath('/crm/catalogs')
  revalidatePath('/portal/catalogs')
  revalidatePath('/portal/catalogue')
  revalidatePath('/portal')
  if (id) revalidatePath(`/crm/catalogs/${id}`)
}

async function syncPrimaryCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
) {
  const { data: rows, error } = await supabase
    .from('catalog_assignments')
    .select('company_id, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) return { error: schemaHint(error.message) }
  const companyId = rows?.[0]?.company_id ?? null
  const { error: updateError } = await supabase.from('campaigns').update({ company_id: companyId }).eq('id', campaignId)
  if (updateError) return { error: schemaHint(updateError.message) }
  return { companyId }
}

export async function createCatalog(formData: FormData) {
  return withIdempotency('crm.createCatalog', formData, () => createCatalogOnce(formData))
}

async function createCatalogOnce(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = String(formData.get('name') || '').trim()
  // Zero or more companies. The first one becomes the default (campaigns.company_id) for pricing new lines.
  const companyIds = [...new Set(formData.getAll('company_id').map((value) => String(value)).filter(isUuid))]
  const companyId = companyIds[0] || ''
  const employeeQuantity = Number(formData.get('employee_quantity') || 0)
  const budgetPerEmployee = Number(formData.get('budget_per_employee') || 0)
  if (!name) return { error: 'Catalog name is required' }

  const { data, error } = await supabase.from('campaigns').insert({
    name,
    company_id: companyId || null,
    owner_id: user.id,
    occasion: String(formData.get('occasion') || '') || null,
    description: String(formData.get('description') || '') || null,
    employee_quantity: employeeQuantity || 1,
    budget_per_employee: budgetPerEmployee || 0,
    total_budget: (employeeQuantity || 1) * (budgetPerEmployee || 0),
    required_delivery_date: String(formData.get('required_delivery_date') || '') || null,
    status: 'planning',
  }).select('id').single()
  if (error) return { error: schemaHint(error.message) }

  if (companyIds.length) {
    const { error: assignError } = await supabase.from('catalog_assignments').insert(
      companyIds.map((id) => ({ campaign_id: data.id, company_id: id, assigned_by: user.id })),
    )
    if (assignError) return { error: schemaHint(assignError.message) }
  }

  revalidateCatalog(data.id)
  redirect(`/crm/catalogs/${data.id}`)
}

export async function updateCatalog(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  if (!id || !name) return { error: 'Catalog name is required' }

  const employeeQuantity = Number(formData.get('employee_quantity') || 0)
  const budgetPerEmployee = Number(formData.get('budget_per_employee') || 0)
  const { error } = await supabase.from('campaigns').update({
    name,
    occasion: String(formData.get('occasion') || '') || null,
    description: String(formData.get('description') || '') || null,
    employee_quantity: employeeQuantity || 1,
    budget_per_employee: budgetPerEmployee || 0,
    total_budget: (employeeQuantity || 1) * (budgetPerEmployee || 0),
    required_delivery_date: String(formData.get('required_delivery_date') || '') || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidateCatalog(id)
  return { success: true }
}

export async function duplicateCatalog(formData: FormData) {
  return withIdempotency('crm.duplicateCatalog', formData, () => duplicateCatalogOnce(formData))
}

async function duplicateCatalogOnce(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const sourceId = String(formData.get('campaign_id') || '')
  const targetCompany = String(formData.get('company_id') || '')
  if (!sourceId) return { error: 'Catalog is required' }

  const { data: source, error: sourceError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle()
  if (sourceError) return { error: sourceError.message }
  if (!source) return { error: 'Catalog not found' }

  const requestedName = String(formData.get('name') || '').trim()
  const name = requestedName || duplicateCatalogName(String(source.name))
  const sourceRow = source as Record<string, unknown>

  const payload: Record<string, unknown> = {
    name,
    company_id: targetCompany || null,
    owner_id: user.id,
    occasion: source.occasion ?? null,
    description: source.description ?? null,
    employee_quantity: source.employee_quantity ?? 1,
    budget_per_employee: source.budget_per_employee ?? 0,
    total_budget: source.total_budget ?? 0,
    required_delivery_date: source.required_delivery_date ?? null,
    status: 'planning',
    published_to_client_at: null,
    cloned_from: source.id,
  }
  if ('start_date' in sourceRow) payload.start_date = sourceRow.start_date
  if ('end_date' in sourceRow) payload.end_date = sourceRow.end_date

  let { data: created, error } = await supabase.from('campaigns').insert(payload).select('id').single()
  if (error && /cloned_from/i.test(error.message)) {
    delete payload.cloned_from
    const retry = await supabase.from('campaigns').insert(payload).select('id').single()
    created = retry.data
    error = retry.error
  }
  if (error || !created) return { error: schemaHint(error?.message || 'Could not duplicate catalog') }

  if (targetCompany) {
    const { error: assignError } = await supabase.from('catalog_assignments').insert({
      campaign_id: created.id,
      company_id: targetCompany,
      assigned_by: user.id,
    })
    if (assignError) return { error: schemaHint(assignError.message) }
  }

  const { data: offerings, error: offeringsError } = await supabase
    .from('campaign_products')
    .select('*')
    .eq('campaign_id', sourceId)
    .order('display_order')
  if (offeringsError) return { error: offeringsError.message }

  const kitIds = new Map<string, string>()
  for (const row of offerings || []) {
    let packKitId = row.pack_kit_id as string | null
    if (packKitId) {
      const mapped = kitIds.get(packKitId) || randomUUID()
      kitIds.set(packKitId, mapped)
      packKitId = mapped
    }
    const { error: insertError } = await supabase.from('campaign_products').insert({
      campaign_id: created.id,
      product_id: row.product_id,
      display_name: row.display_name,
      client_description: row.client_description,
      client_image_url: row.client_image_url,
      selling_price: row.selling_price,
      moq: row.moq,
      visibility: 'draft',
      pack_option: row.pack_option,
      pack_kit_id: packKitId,
      pack_kit_role: row.pack_kit_role,
      pack_kit_total: row.pack_kit_total,
      display_order: row.display_order,
      personalization_options: row.personalization_options,
      estimated_delivery: row.estimated_delivery,
      // Per-line override and pack pricing context travel with the copy (absent before migration 20261009).
      ...(row.manual_price != null ? { manual_price: row.manual_price } : {}),
      ...(row.priced_company_id ? { priced_company_id: row.priced_company_id } : {}),
      created_by: user.id,
    })
    if (insertError) return { error: insertError.message }
  }

  revalidateCatalog(created.id)
  redirect(`/crm/catalogs/${created.id}`)
}

export async function assignCatalogCompany(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const companyId = String(formData.get('company_id') || '')
  if (!campaignId || !companyId) return { error: 'Catalog and company are required' }

  const { error } = await supabase.from('catalog_assignments').insert({
    campaign_id: campaignId,
    company_id: companyId,
    assigned_by: user.id,
  })
  if (error) {
    // Already assigned (a repeated request): nothing to do, the end state is what was asked for.
    if (error.code !== '23505') return { error: schemaHint(error.message) }
  }

  const synced = await syncPrimaryCompany(supabase, campaignId)
  if (synced.error) return synced
  revalidateCatalog(campaignId)
  return { success: true }
}

export async function unassignCatalogCompany(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const companyId = String(formData.get('company_id') || '')
  if (!campaignId || !companyId) return { error: 'Catalog and company are required' }

  const { error } = await supabase
    .from('catalog_assignments')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('company_id', companyId)
  if (error) return { error: schemaHint(error.message) }

  const synced = await syncPrimaryCompany(supabase, campaignId)
  if (synced.error) return synced
  revalidateCatalog(campaignId)
  return { success: true }
}

function priceForCompany(
  product: { price?: number | null },
  companyMargin: number | null,
  special?: { price: number; validUntil: string | null },
) {
  return listedUnitPrice({
    specialPrice: special?.price,
    specialValidUntil: special?.validUntil,
    basePrice: product.price,
    companyMarginPercent: companyMargin,
  })
}

export async function addCatalogProducts(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const productIds = [...new Set(formData.getAll('product_id').map((value) => String(value)).filter(Boolean))]
  if (!campaignId || productIds.length === 0) return { error: 'Choose at least one product' }

  const { data: catalog } = await supabase.from('campaigns').select('id, company_id').eq('id', campaignId).maybeSingle()
  if (!catalog) return { error: 'Catalog not found' }

  let quantities: Record<string, number> = {}
  try {
    const parsed = JSON.parse(String(formData.get('quantities_json') || '{}'))
    if (parsed && typeof parsed === 'object') quantities = parsed as Record<string, number>
  } catch {
    quantities = {}
  }

  const [{ data: existing }, { data: products }, companyMargin, specials] = await Promise.all([
    supabase.from('campaign_products').select('product_id').eq('campaign_id', campaignId),
    supabase
      .from('products')
      .select('id, name, description, image_url, price, moq, status')
      .in('id', productIds)
      .eq('status', 'active'),
    catalog.company_id ? getCompanyMarginPercent(catalog.company_id) : Promise.resolve(null),
    specialPricesForCompany(supabase, catalog.company_id, productIds),
  ])

  const taken = new Set((existing || []).map((row) => row.product_id))
  const byId = new Map((products || []).map((product) => [product.id, product]))
  let added = 0
  let skipped = 0

  for (const productId of productIds) {
    if (taken.has(productId)) {
      skipped += 1
      continue
    }
    const product = byId.get(productId)
    if (!product) {
      skipped += 1
      continue
    }
    const requested = Math.round(Number(quantities[productId]))
    const moq = Number.isInteger(requested) && requested > 0 ? requested : (product.moq || 1)
    const sellingPrice = priceForCompany(product, companyMargin, specials.get(productId))
    const { error } = await supabase.from('campaign_products').insert({
      campaign_id: campaignId,
      product_id: productId,
      display_name: product.name,
      client_description: product.description,
      client_image_url: product.image_url,
      selling_price: sellingPrice || 0,
      moq,
      visibility: 'draft',
      created_by: user.id,
    })
    if (error) {
      // A concurrent request added it first (unique campaign_id + product_id): count it as skipped.
      if (error.code === '23505') {
        skipped += 1
        continue
      }
      return { error: error.message }
    }
    added += 1
  }

  revalidateCatalog(campaignId)
  return { success: true, added, skipped }
}

export async function setCatalogProductVisibility(formData: FormData) {
  const supabase = await createClient()
  const campaignId = String(formData.get('campaign_id') || '')
  const id = String(formData.get('id') || '')
  const visibility = String(formData.get('visibility') || 'draft')
  const { data: { user } } = await supabase.auth.getUser()

  if (visibility === 'published') {
    const { data: offering } = await supabase
      .from('campaign_products')
      .select('id, product:products!inner(status)')
      .eq('id', id)
      .maybeSingle()
    const product = Array.isArray(offering?.product) ? offering?.product[0] : offering?.product
    if (!offering || product?.status !== 'active') {
      return { error: 'Only active catalogue products can be published to the client' }
    }
  }

  const { error } = await supabase.from('campaign_products').update({
    visibility,
    published_at: visibility === 'published' ? new Date().toISOString() : null,
    published_by: visibility === 'published' ? user?.id : null,
  }).eq('id', id)
  if (error) return { error: error.message }

  if (visibility === 'published') {
    await supabase.from('campaigns').update({
      published_to_client_at: new Date().toISOString(),
      status: 'published_to_client',
    }).eq('id', campaignId)
  }
  revalidateCatalog(campaignId)
  return { success: true }
}

export async function publishCatalog(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  if (!campaignId) return { error: 'Catalog is required' }

  const { data: rows, error: fetchError } = await supabase
    .from('campaign_products')
    .select('id, visibility, product:products!inner(status)')
    .eq('campaign_id', campaignId)
  if (fetchError) return { error: fetchError.message }
  if (!rows?.length) return { error: 'Add products before publishing this catalog.' }

  const draftIds: string[] = []
  for (const row of rows) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    if (row.visibility === 'published') continue
    if (product?.status !== 'active') continue
    draftIds.push(row.id)
  }

  if (draftIds.length) {
    const { error } = await supabase
      .from('campaign_products')
      .update({
        visibility: 'published',
        published_at: new Date().toISOString(),
        published_by: user.id,
      })
      .in('id', draftIds)
    if (error) return { error: error.message }
  } else if (!rows.some((row) => row.visibility === 'published')) {
    return { error: 'No active products are ready to publish.' }
  }

  const { error: statusError } = await supabase
    .from('campaigns')
    .update({
      published_to_client_at: new Date().toISOString(),
      status: 'published_to_client',
    })
    .eq('id', campaignId)
  if (statusError) return { error: statusError.message }

  revalidateCatalog(campaignId)
  return { success: true, count: draftIds.length }
}

export async function removeCatalogProduct(formData: FormData) {
  const supabase = await createClient()
  const campaignId = String(formData.get('campaign_id') || '')
  const id = String(formData.get('id') || '')
  const { error } = await supabase.from('campaign_products').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateCatalog(campaignId)
  return { success: true }
}

type OpenShareLink = {
  id: string
  token: string
  expires_at: string | null
  revoked_at: string | null
}

function revalidateShareToken(token?: string | null) {
  if (token) revalidatePath(`/share/catalogs/${token}`)
}

async function openShareLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
) {
  const { data, error } = await supabase
    .from('catalog_share_links')
    .select('id, token, expires_at, revoked_at')
    .eq('campaign_id', campaignId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) return { error: schemaHint(error.message), links: [] as OpenShareLink[] }
  return { links: (data || []) as OpenShareLink[], error: undefined }
}

async function revokeShareLinkIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
  revokedAt: string,
) {
  if (!ids.length) return { error: undefined }
  const { data, error } = await supabase
    .from('catalog_share_links')
    .update({ revoked_at: revokedAt })
    .in('id', ids)
    .is('revoked_at', null)
    .select('id')
  if (error) return { error: schemaHint(error.message) }
  if ((data?.length || 0) !== ids.length) {
    return { error: 'Could not revoke the share link. Refresh and try again.' }
  }
  return { error: undefined }
}

export async function generateCatalogShareLink(formData: FormData) {
  return withIdempotency('crm.generateCatalogShareLink', formData, () => generateCatalogShareLinkOnce(formData))
}

async function generateCatalogShareLinkOnce(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const noExpiry = formData.get('no_expiry') === '1'
  if (!campaignId) return { error: 'Catalog is required' }

  // Optional: price this link with one assigned company's margin.
  const linkCompany = String(formData.get('company_id') || '')
  if (linkCompany) {
    if (!isUuid(linkCompany) || !(await companyCanUseCatalog(supabase, campaignId, linkCompany))) {
      return { error: 'Choose a company this catalog is assigned to.' }
    }
  }

  const existing = await openShareLinks(supabase, campaignId)
  if (existing.error) return { error: existing.error }

  const now = new Date()
  const token = randomBytes(24).toString('base64url')
  const expiresAt = noExpiry ? null : shareExpiryIso(now)
  const linkRow: Record<string, unknown> = {
    campaign_id: campaignId,
    token,
    expires_at: expiresAt,
    created_by: user.id,
  }
  let { data: created, error } = await supabase.from('catalog_share_links').insert(
    linkCompany ? { ...linkRow, company_id: linkCompany } : linkRow,
  ).select('id, token, expires_at').single()
  if (error && linkCompany && /company_id/i.test(error.message)) {
    // Migration 20261009 not applied yet: the link still works, priced for the catalog default.
    ;({ data: created, error } = await supabase.from('catalog_share_links').insert(linkRow).select('id, token, expires_at').single())
  }
  if (error || !created) return { error: schemaHint(error?.message || 'Could not create a share link.') }

  const previousIds = existing.links.map((link) => link.id)
  const revoked = await revokeShareLinkIds(supabase, previousIds, now.toISOString())
  if (revoked.error) {
    await supabase.from('catalog_share_links').delete().eq('id', created.id)
    return { error: revoked.error }
  }

  revalidateCatalog(campaignId)
  for (const link of existing.links) revalidateShareToken(link.token)
  revalidateShareToken(created.token)
  return {
    success: true,
    url: `${await shareLinkOrigin()}${sharePath(created.token)}`,
    expiresAt: created.expires_at,
    expired: shareLinkIsExpired(created.expires_at),
  }
}

export async function extendCatalogShareLink(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  if (!campaignId) return { error: 'Catalog is required' }
  const current = await openShareLinks(supabase, campaignId)
  if (current.error) return { error: current.error }
  const link = current.links[0]
  if (!link) return { error: 'Generate a share link first.' }

  const expiresAt = extendShareExpiry(link.expires_at, new Date())
  const { data, error } = await supabase
    .from('catalog_share_links')
    .update({ expires_at: expiresAt })
    .eq('id', link.id)
    .is('revoked_at', null)
    .select('token, expires_at')
    .maybeSingle()
  if (error) return { error: schemaHint(error.message) }
  if (!data?.token) return { error: 'Could not update this share link. Refresh and try again.' }
  revalidateCatalog(campaignId)
  revalidateShareToken(data.token)
  return {
    success: true,
    url: `${await shareLinkOrigin()}${sharePath(data.token)}`,
    expiresAt: data.expires_at,
    expired: shareLinkIsExpired(data.expires_at),
  }
}

export async function revokeCatalogShareLink(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  if (!campaignId) return { error: 'Catalog is required' }
  const current = await openShareLinks(supabase, campaignId)
  if (current.error) return { error: current.error }

  const revoked = await revokeShareLinkIds(
    supabase,
    current.links.map((link) => link.id),
    new Date().toISOString(),
  )
  if (revoked.error) return { error: revoked.error }
  revalidateCatalog(campaignId)
  for (const link of current.links) revalidateShareToken(link.token)
  return { success: true, url: null, expiresAt: null, expired: false }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char
  ))
}

export async function emailCatalogLink(formData: FormData) {
  return withIdempotency('crm.emailCatalogLink', formData, () => emailCatalogLinkOnce(formData))
}

async function emailCatalogLinkOnce(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const to = String(formData.get('email') || '').trim()
  if (!campaignId) return { error: 'Catalog is required' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: 'Enter a valid email address' }

  const { data: catalog } = await supabase.from('campaigns').select('name').eq('id', campaignId).maybeSingle()
  if (!catalog) return { error: 'Catalog not found' }

  const current = await openShareLinks(supabase, campaignId)
  if (current.error) return { error: current.error }
  const link = current.links[0]
  if (!link) return { error: 'Generate a share link first.', shareUrl: null }
  if (!shareLinkGrantsAccess(link)) return { error: 'This share link has expired. Generate a new one.', shareUrl: null }

  const shareUrl = `${await shareLinkOrigin()}${sharePath(link.token)}`
  const subject = `Catalog: ${catalog.name}`
  const sent = await sendEmail({
    to,
    subject,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1C1917;">
        <h1 style="font-size: 20px;">${escapeHtml(catalog.name)}</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #5A5248;">
          A curated gift catalog is ready to review. No login is required.
        </p>
        <p style="margin: 28px 0;">
          <a href="${escapeHtml(shareUrl)}"
             style="background:#806A50;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
            Open catalog
          </a>
        </p>
        <p style="font-size: 12px; line-height: 1.6; color: #7A7267;">${escapeHtml(shareUrl)}</p>
        <p style="font-size: 12px; line-height: 1.6; color: #7A7267;">Sent by ${escapeHtml(appName())}.</p>
      </div>
    `,
  })
  if (sent.error) return { error: sent.error, shareUrl }
  return { success: true, shareUrl }
}

export async function removeCatalog(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Catalog is required' }

  const { count: orderCount } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('campaign_id', id)
  if (orderCount) {
    const { error } = await supabase.from('campaigns').update({ status: 'closed' }).eq('id', id)
    if (error) return { error: error.message }
    revalidateCatalog(id)
    redirect(`/crm/catalogs/${id}?removed=archived`)
  }

  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) {
    await supabase.from('campaigns').update({ status: 'closed' }).eq('id', id)
    return { error: 'This catalog could not be deleted. It was closed instead.' }
  }
  revalidateCatalog()
  redirect('/crm/catalogs')
}

/** Set or clear the explicit price on one catalog line. Blank = price from cost and each company's margin. */
export async function setCatalogManualPrice(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const id = String(formData.get('id') || '')
  if (!isUuid(campaignId) || !isUuid(id)) return { error: 'Catalog line not found' }

  const raw = String(formData.get('manual_price') || '').trim()
  let manualPrice: number | null = null
  if (raw) {
    manualPrice = Number(raw)
    if (!Number.isFinite(manualPrice) || manualPrice < 0) return { error: 'Enter a price of zero or more, or leave it blank to use margins.' }
    manualPrice = Math.round((manualPrice + Number.EPSILON) * 100) / 100
  }

  const { data, error } = await supabase
    .from('campaign_products')
    .update({ manual_price: manualPrice })
    .eq('id', id)
    .eq('campaign_id', campaignId)
    .select('id')
  if (error) {
    return {
      error: /manual_price/i.test(error.message)
        ? `${error.message} Apply supabase/migrations/20261009_catalog_per_company_pricing.sql first.`
        : error.message,
    }
  }
  if (!data?.length) return { error: 'Catalog line not found' }

  revalidateCatalog(campaignId)
  return { success: true, message: manualPrice == null ? 'Using each company\'s margin' : 'Manual price saved' }
}
