'use server'

import { randomBytes, randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { requestOrigin } from '@/lib/auth/request-origin'
import { sendEmail } from '@/lib/email/resend'
import { resolveProductSellPrice, getCompanyMarginPercent, getMarginSettings, getPricingSettings, loadSupplierOffers, supplierCostForProduct } from '@/lib/pricing/server'
import { offersByProduct } from '@/lib/pricing/offers'
import { buildBudgetPackCandidates, planBudgetPacks } from '@/lib/catalogue/budget-packs-server'
import { formatKitItemNames, PACK_OPTION_LABELS } from '@/lib/catalogue/budget-packs'
import { sharePath } from '@/lib/catalogs/share'
import { appName } from '@/lib/brand'
import { extendShareExpiry, shareExpiryIso, shareLinkGrantsAccess, shareLinkIsExpired } from '@/lib/catalogs/share-link'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = String(formData.get('name') || '').trim()
  const companyId = String(formData.get('company_id') || '')
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

  if (companyId) {
    const { error: assignError } = await supabase.from('catalog_assignments').insert({
      campaign_id: data.id,
      company_id: companyId,
      assigned_by: user.id,
    })
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
  const name = requestedName || `${source.name} copy`
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
    .select('product_id, display_name, client_description, client_image_url, selling_price, moq, pack_option, pack_kit_id, pack_kit_role, pack_kit_total, display_order, personalization_options, estimated_delivery')
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
    if (error.code === '23505') return { error: 'That company is already assigned to this catalog.' }
    return { error: schemaHint(error.message) }
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

async function priceForCompany(
  product: { id?: string; moq?: number | null; supplier_cost?: number | null; price?: number | null; internal_margin?: number | null },
  companyId: string | null,
  settings: Awaited<ReturnType<typeof getMarginSettings>>,
  companyMargin: number | null,
  supplierCost?: number | null,
) {
  const resolved = await resolveProductSellPrice(
    { ...product, supplier_cost: supplierCost === undefined ? product.supplier_cost : supplierCost },
    {
      channel: 'b2b',
      companyId,
      companyMarginPercent: companyMargin,
      settings,
    },
  )
  return resolved.sellPrice
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

  const [{ data: existing }, { data: products }, settings, pricing, companyMargin] = await Promise.all([
    supabase.from('campaign_products').select('product_id').eq('campaign_id', campaignId),
    supabase
      .from('products')
      .select('id, name, description, image_url, price, moq, status, supplier_cost, internal_margin')
      .in('id', productIds)
      .eq('status', 'active'),
    getMarginSettings(),
    getPricingSettings(),
    catalog.company_id ? getCompanyMarginPercent(catalog.company_id) : Promise.resolve(null),
  ])
  const offerGroups = pricing.surfaces.portal.useBestCost
    ? offersByProduct(await loadSupplierOffers(supabase, (products || []).map((product) => product.id)))
    : new Map()

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
    const sellingPrice = await priceForCompany(
      product,
      catalog.company_id,
      settings,
      companyMargin,
      supplierCostForProduct(product, offerGroups.get(product.id) || [], {
        useBestCost: pricing.surfaces.portal.useBestCost,
        requireInStock: pricing.requireInStock,
        quantity: product.moq,
      }),
    )
    const { error } = await supabase.from('campaign_products').insert({
      campaign_id: campaignId,
      product_id: productId,
      display_name: product.name,
      client_description: product.description,
      client_image_url: product.image_url,
      selling_price: sellingPrice || 0,
      moq: product.moq || 1,
      visibility: 'draft',
      created_by: user.id,
    })
    if (error) return { error: error.message }
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

export async function generateBudgetPackOptions(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const replacePublished = formData.get('replace') === '1'
  if (!campaignId) return { error: 'Catalog is required' }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, company_id, budget_per_employee, name')
    .eq('id', campaignId)
    .maybeSingle()
  if (!campaign) return { error: 'Catalog not found' }
  if (!campaign.company_id) {
    return { error: 'Assign a company before generating budget packs. Sell prices use that company\'s margin.' }
  }

  const budget = Number(campaign.budget_per_employee)
  if (!Number.isFinite(budget) || budget <= 0) {
    return { error: 'Set a budget per person on this catalog before generating options.' }
  }

  let packQuery = supabase
    .from('campaign_products')
    .select('id')
    .eq('campaign_id', campaignId)
    .not('pack_option', 'is', null)
  if (!replacePublished) {
    packQuery = packQuery.eq('visibility', 'draft')
  }
  const { data: packRows } = await packQuery
  const packIds = (packRows || []).map((row) => row.id)
  if (packIds.length) {
    const { error: deleteError } = await supabase.from('campaign_products').delete().in('id', packIds)
    if (deleteError) return { error: deleteError.message }
  }

  const { data: remaining } = await supabase
    .from('campaign_products')
    .select('product_id')
    .eq('campaign_id', campaignId)
  const takenProductIds = new Set((remaining || []).map((row) => row.product_id).filter(Boolean))

  const { candidates, priced } = await buildBudgetPackCandidates(campaign.company_id, budget)
  const freeCandidates = candidates.filter((candidate) => !takenProductIds.has(candidate.id))
  const picks = planBudgetPacks(freeCandidates, budget)
  if (picks.length === 0) {
    return {
      error: takenProductIds.size
        ? `No unused catalogue products fit within ${budget} per person. Remove existing catalog products, or use Replace all packs, then try again.`
        : `No active catalogue products fit within ${budget} per person for this company. Add products or raise the budget.`,
    }
  }

  const displayOrderBase = picks.length * 10
  let order = 0
  const insertedProductIds = new Set<string>()
  for (const kit of picks) {
    const kitId = randomUUID()
    const kitProducts = kit.productIds
      .map((id) => priced.get(id))
      .filter((product): product is NonNullable<typeof product> => Boolean(product))
      .filter((product) => !insertedProductIds.has(product.id) && !takenProductIds.has(product.id))
    if (!kitProducts.length) continue

    const names = kitProducts.map((product) => product.name)
    const label = PACK_OPTION_LABELS[kit.packOption]
    const kitDescription = `Multi-item kit for ${campaign.name}. Combined price per person is within your ${budget} budget.`
    const kitTotal = Math.round(
      (kitProducts.reduce((sum, product) => sum + product.sellPrice, 0) + Number.EPSILON) * 100
    ) / 100

    let lineOrder = 0
    for (let i = 0; i < kitProducts.length; i++) {
      const product = kitProducts[i]
      const isPrimary = i === 0
      const { error } = await supabase.from('campaign_products').insert({
        campaign_id: campaignId,
        product_id: product.id,
        display_name: isPrimary ? `${label}: ${formatKitItemNames(names)}` : product.name,
        client_description: isPrimary ? kitDescription : product.description || `Included in ${label}.`,
        client_image_url: product.image_url,
        selling_price: product.sellPrice,
        pack_kit_total: isPrimary ? kitTotal : null,
        moq: product.moq || 1,
        visibility: 'draft',
        pack_option: kit.packOption,
        pack_kit_id: kitId,
        pack_kit_role: isPrimary ? 'primary' : 'line',
        display_order: displayOrderBase + order + lineOrder,
        created_by: user.id,
      })
      if (error) return { error: error.message }
      insertedProductIds.add(product.id)
      lineOrder += 1
    }
    order += 10
  }

  if (insertedProductIds.size === 0) {
    return { error: 'Could not create kit options — every candidate product is already on this catalog.' }
  }

  revalidateCatalog(campaignId)
  return { success: true, count: picks.length }
}

export async function publishBudgetPackOptions(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  if (!campaignId) return { error: 'Catalog is required' }

  const { data: rows, error: fetchError } = await supabase
    .from('campaign_products')
    .select('id, product:products!inner(status)')
    .eq('campaign_id', campaignId)
    .not('pack_option', 'is', null)
    .eq('visibility', 'draft')

  if (fetchError) return { error: fetchError.message }
  if (!rows?.length) return { error: 'No draft budget pack options to publish.' }

  for (const row of rows) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    if (product?.status !== 'active') {
      return { error: 'All pack products must be active before publishing.' }
    }
  }

  const ids = rows.map((row) => row.id)
  const { error } = await supabase
    .from('campaign_products')
    .update({
      visibility: 'published',
      published_at: new Date().toISOString(),
      published_by: user.id,
    })
    .in('id', ids)
  if (error) return { error: error.message }

  await supabase
    .from('campaigns')
    .update({
      published_to_client_at: new Date().toISOString(),
      status: 'published_to_client',
    })
    .eq('id', campaignId)

  revalidateCatalog(campaignId)
  return { success: true, count: ids.length }
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
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const noExpiry = formData.get('no_expiry') === '1'
  if (!campaignId) return { error: 'Catalog is required' }

  const existing = await openShareLinks(supabase, campaignId)
  if (existing.error) return { error: existing.error }

  const now = new Date()
  const token = randomBytes(24).toString('base64url')
  const expiresAt = noExpiry ? null : shareExpiryIso(now)
  const { data: created, error } = await supabase.from('catalog_share_links').insert({
    campaign_id: campaignId,
    token,
    expires_at: expiresAt,
    created_by: user.id,
  }).select('id, token, expires_at').single()
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
    url: `${await requestOrigin()}${sharePath(created.token)}`,
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
    url: `${await requestOrigin()}${sharePath(data.token)}`,
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

  const shareUrl = `${await requestOrigin()}${sharePath(link.token)}`
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
