'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { resolveProductSellPrice } from '@/lib/pricing/server'
import { buildBudgetPackCandidates, planBudgetPacks } from '@/lib/catalogue/budget-packs-server'
import { formatKitItemNames, PACK_OPTION_LABELS } from '@/lib/catalogue/budget-packs'
import { randomUUID } from 'crypto'
import { requireStaff } from '@/lib/auth'

export async function createCampaign(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = String(formData.get('name') || '').trim()
  const companyId = String(formData.get('company_id') || '')
  const employeeQuantity = Number(formData.get('employee_quantity') || 0)
  const budgetPerEmployee = Number(formData.get('budget_per_employee') || 0)
  if (!name || !companyId) return { error: 'Campaign name and company are required' }

  const { data, error } = await supabase.from('campaigns').insert({
    name,
    company_id: companyId,
    owner_id: user.id,
    occasion: String(formData.get('occasion') || '') || null,
    description: String(formData.get('description') || '') || null,
    employee_quantity: employeeQuantity || 1,
    budget_per_employee: budgetPerEmployee || 0,
    total_budget: (employeeQuantity || 1) * (budgetPerEmployee || 0),
    required_delivery_date: String(formData.get('required_delivery_date') || '') || null,
    status: 'planning',
  }).select('id').single()
  if (error) return { error: error.message }
  revalidatePath('/crm/campaigns')
  redirect(`/crm/campaigns/${data.id}`)
}

export async function addCampaignProduct(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const productId = String(formData.get('product_id') || '')
  const sellingPriceRaw = String(formData.get('selling_price') || '').trim()
  const sellingPriceManual = sellingPriceRaw ? Number(sellingPriceRaw) : null
  if (!campaignId || !productId) return { error: 'Campaign and product are required' }
  if (sellingPriceManual != null && (!Number.isFinite(sellingPriceManual) || sellingPriceManual < 0)) {
    return { error: 'Selling price must be a number ≥ 0' }
  }

  const [{ data: product }, { data: campaign }] = await Promise.all([
    supabase
      .from('products')
      .select('name, description, image_url, price, moq, status, supplier_cost, internal_margin')
      .eq('id', productId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase.from('campaigns').select('id, company_id').eq('id', campaignId).maybeSingle(),
  ])
  if (!product) return { error: 'Choose an active catalogue product' }
  if (!campaign) return { error: 'Campaign not found' }

  let sellingPrice = sellingPriceManual
  if (sellingPrice == null) {
    const resolved = await resolveProductSellPrice(product, {
      channel: 'b2b',
      companyId: campaign.company_id,
    })
    sellingPrice = resolved.sellPrice
  }

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
  revalidatePath(`/crm/campaigns/${campaignId}`)
  return { success: true }
}

export async function setCampaignProductVisibility(formData: FormData) {
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
  revalidatePath(`/crm/campaigns/${campaignId}`)
  revalidatePath('/portal/catalogue')
  return { success: true }
}

export async function removeCampaignProduct(formData: FormData) {
  const supabase = await createClient()
  const campaignId = String(formData.get('campaign_id') || '')
  const id = String(formData.get('id') || '')
  const { error } = await supabase.from('campaign_products').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/crm/campaigns/${campaignId}`)
  return { success: true }
}

export async function updateCampaign(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  if (!id || !name) return { error: 'Campaign name is required' }

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
  revalidatePath('/crm/campaigns')
  revalidatePath(`/crm/campaigns/${id}`)
  return { success: true }
}

export async function generateBudgetPackOptions(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  const replacePublished = formData.get('replace') === '1'
  if (!campaignId) return { error: 'Campaign is required' }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, company_id, budget_per_employee, name')
    .eq('id', campaignId)
    .maybeSingle()
  if (!campaign?.company_id) return { error: 'Campaign not found' }

  const budget = Number(campaign.budget_per_employee)
  if (!Number.isFinite(budget) || budget <= 0) {
    return { error: 'Set a budget per person on this campaign before generating options.' }
  }

  // Always clear draft packs first. Optionally clear published packs too.
  // campaign_products has UNIQUE(campaign_id, product_id), so reused products must be removed.
  let packQuery = supabase
    .from('campaign_products')
    .select('id')
    .eq('campaign_id', campaignId)
    .not('pack_option', 'is', null)
  if (!replacePublished) {
    packQuery = packQuery.eq('visibility', 'draft')
  }
  const { data: packRows } = await packQuery
  const packIds = (packRows || []).map((r) => r.id)
  if (packIds.length) {
    const { error: deleteError } = await supabase.from('campaign_products').delete().in('id', packIds)
    if (deleteError) return { error: deleteError.message }
  }

  // Products still attached to this campaign (manual offerings / leftover published kits) cannot be reused.
  const { data: remaining } = await supabase
    .from('campaign_products')
    .select('product_id')
    .eq('campaign_id', campaignId)
  const takenProductIds = new Set((remaining || []).map((r) => r.product_id).filter(Boolean))

  const { candidates, priced } = await buildBudgetPackCandidates(campaign.company_id, budget)
  const freeCandidates = candidates.filter((c) => !takenProductIds.has(c.id))
  const picks = planBudgetPacks(freeCandidates, budget)
  if (picks.length === 0) {
    return {
      error: takenProductIds.size
        ? `No unused catalogue products fit within ${budget} per person. Remove existing campaign products, or use Replace published packs, then try again.`
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
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .filter((p) => !insertedProductIds.has(p.id) && !takenProductIds.has(p.id))
    if (!kitProducts.length) continue

    const names = kitProducts.map((p) => p.name)
    const label = PACK_OPTION_LABELS[kit.packOption]
    const kitDescription = `Multi-item kit for ${campaign.name}. Combined price per person is within your ${budget} budget.`
    const kitTotal = Math.round(
      (kitProducts.reduce((sum, p) => sum + p.sellPrice, 0) + Number.EPSILON) * 100
    ) / 100

    let lineOrder = 0
    for (let i = 0; i < kitProducts.length; i++) {
      const product = kitProducts[i]
      const isPrimary = i === 0
      const { error } = await supabase.from('campaign_products').insert({
        campaign_id: campaignId,
        product_id: product.id,
        display_name: isPrimary
          ? `${label}: ${formatKitItemNames(names)}`
          : product.name,
        client_description: isPrimary
          ? kitDescription
          : product.description || `Included in ${label}.`,
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
    return { error: 'Could not create kit options — every candidate product is already on this campaign.' }
  }

  revalidatePath(`/crm/campaigns/${campaignId}`)
  revalidatePath('/portal/catalogue')
  return { success: true, count: picks.length }
}

export async function publishBudgetPackOptions(formData: FormData) {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const campaignId = String(formData.get('campaign_id') || '')
  if (!campaignId) return { error: 'Campaign is required' }

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

  const ids = rows.map((r) => r.id)
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

  revalidatePath(`/crm/campaigns/${campaignId}`)
  revalidatePath('/portal/catalogue')
  revalidatePath('/portal/campaigns')
  return { success: true, count: ids.length }
}

export async function removeCampaign(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Campaign is required' }

  const { count: orderCount } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('campaign_id', id)
  if (orderCount) {
    const { error } = await supabase.from('campaigns').update({ status: 'closed' }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/crm/campaigns')
    revalidatePath(`/crm/campaigns/${id}`)
    redirect(`/crm/campaigns/${id}?removed=archived`)
  }

  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) {
    await supabase.from('campaigns').update({ status: 'closed' }).eq('id', id)
    return { error: 'This campaign could not be deleted. It was closed instead.' }
  }
  revalidatePath('/crm/campaigns')
  redirect('/crm/campaigns')
}
