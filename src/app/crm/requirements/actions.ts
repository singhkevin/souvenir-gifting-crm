'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { writeAudit } from '@/lib/audit'
import { offersByProduct } from '@/lib/pricing/offers'
import { resolveSellPrice } from '@/lib/pricing/resolve'
import { getCompanyMarginPercent, getPricingSettings, loadSupplierOffers, supplierCostForProduct } from '@/lib/pricing/server'
import { withIdempotency } from '@/lib/idempotency'

export async function createRequirement(formData: FormData) {
  return withIdempotency('crm.createRequirement', formData, () => createRequirementOnce(formData))
}

async function createRequirementOnce(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = String(formData.get('name') || '').trim()
  const companyId = String(formData.get('company_id') || '')
  if (!name || !companyId) return { error: 'Requirement name and company are required' }

  const quantity = Number(formData.get('quantity') || 1)
  const budget = formData.get('budget') ? Number(formData.get('budget')) : null
  const payload = {
    name,
    company_id: companyId,
    contact_id: String(formData.get('contact_id') || '') || null,
    lead_id: String(formData.get('lead_id') || '') || null,
    owner_id: String(formData.get('owner_id') || '') || user.id,
    quantity: quantity > 0 ? quantity : 1,
    budget,
    revenue_opportunity: budget || 0,
    deadline: String(formData.get('deadline') || '') || null,
    delivery_city: String(formData.get('delivery_city') || '') || null,
    purpose: String(formData.get('purpose') || '') || null,
    payment_terms: String(formData.get('payment_terms') || '') || null,
    description: String(formData.get('description') || '') || null,
    department_name: String(formData.get('department_name') || '') || null,
    status: 'active',
  }

  const { data, error } = await supabase.from('requirements').insert(payload).select('id').single()
  if (error) return { error: error.message }
  await writeAudit(supabase, {
    action: 'create',
    entity: 'requirement',
    entityId: data.id,
    next: payload,
    userId: user.id,
  })
  revalidatePath('/crm/requirements')
  redirect(`/crm/requirements/${data.id}?tab=products`)
}

export async function createRequirementFromLead(formData: FormData) {
  return createRequirement(formData)
}

export async function createQuotationFromRequirement(formData: FormData) {
  return withIdempotency('crm.createQuotationFromRequirement', formData, () => createQuotationFromRequirementOnce(formData))
}

async function createQuotationFromRequirementOnce(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const requirementId = String(formData.get('requirement_id') || '')
  if (!requirementId) return { error: 'Requirement is required' }

  const extended = await supabase
    .from('requirements')
    .select('id, company_id, contact_id, owner_id, quantity, campaign_id')
    .eq('id', requirementId)
    .single()

  let req = extended.data as {
    id: string
    company_id: string
    contact_id: string | null
    owner_id: string | null
    quantity: number | null
    campaign_id?: string | null
  } | null
  if (extended.error && /campaign_id/i.test(extended.error.message)) {
    const fallback = await supabase
      .from('requirements')
      .select('id, company_id, contact_id, owner_id, quantity')
      .eq('id', requirementId)
      .single()
    req = fallback.data
  }
  if (!req) return { error: extended.error && !/campaign_id/i.test(extended.error.message) ? extended.error.message : 'Requirement not found' }

  const { data: reqProducts } = await supabase
    .from('requirement_products')
    .select('product_id, quantity, product:products(id, name, price, internal_margin)')
    .eq('requirement_id', req.id)

  if (!reqProducts?.length) {
    return { error: 'Add at least one product before creating a quotation' }
  }

  const sellByProduct = new Map<string, number>()
  if (req.campaign_id) {
    const { data: catalogPrices } = await supabase
      .from('campaign_products')
      .select('product_id, selling_price')
      .eq('campaign_id', req.campaign_id)
      .in('product_id', reqProducts.map((row) => row.product_id))
    for (const row of catalogPrices || []) {
      if (row.selling_price != null) sellByProduct.set(row.product_id, Number(row.selling_price))
    }
  }

  const pricing = await getPricingSettings()
  const companyMargin = req.company_id ? await getCompanyMarginPercent(req.company_id) : null
  const quoteOffers = pricing.surfaces.crm.useBestCost
    ? offersByProduct(await loadSupplierOffers(supabase, reqProducts.map((row) => row.product_id)))
    : new Map()

  const { data: quoteNumber, error: numError } = await supabase.rpc('next_quotation_number')
  if (numError || !quoteNumber) return { error: numError?.message || 'Could not allocate quote number' }

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 14)

  const { data: quote, error } = await supabase
    .from('quotations')
    .insert({
      quotation_number: quoteNumber,
      requirement_id: req.id,
      company_id: req.company_id,
      contact_id: req.contact_id,
      owner_id: req.owner_id || user.id,
      ...(req.campaign_id ? { campaign_id: req.campaign_id } : {}),
      status: 'draft',
      valid_until: validUntil.toISOString().slice(0, 10),
      notes: String(formData.get('notes') || '') || null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  const items = reqProducts.map((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    const qty = row.quantity || req.quantity || 1
    const listOrCatalog = sellByProduct.get(row.product_id) ?? Number(product?.price || 0)
    const bestCost = supplierCostForProduct(
      { id: row.product_id, supplier_cost: null, moq: qty },
      quoteOffers.get(row.product_id) || [],
      {
        useBestCost: pricing.surfaces.crm.useBestCost,
        requireInStock: pricing.requireInStock,
        quantity: qty,
      },
    )
    const derived = pricing.surfaces.crm.useBestCost && pricing.surfaces.crm.showSellPrice && bestCost != null
      ? resolveSellPrice({
          supplierCost: bestCost,
          listPrice: product?.price,
          productMarginPercent: product?.internal_margin,
          companyMarginPercent: companyMargin,
          channel: 'b2b',
          settings: pricing,
        }).sellPrice
      : null
    const unit = derived ?? listOrCatalog
    return {
      quotation_id: quote.id,
      product_id: row.product_id,
      description: product?.name || null,
      quantity: qty,
      unit_price: unit,
      line_total: qty * unit,
    }
  })
  const { error: itemError } = await supabase.from('quotation_items').insert(items)
  if (itemError) return { error: itemError.message }
  await supabase.rpc('recalc_quotation_totals', { p_quotation_id: quote.id })

  await supabase.from('requirements').update({ status: 'quoted' }).eq('id', req.id)

  await writeAudit(supabase, {
    action: 'create',
    entity: 'quotation',
    entityId: quote.id,
    next: { requirement_id: req.id, quotation_number: quoteNumber },
    userId: user.id,
  })
  revalidatePath('/crm/quotations')
  revalidatePath(`/crm/requirements/${req.id}`)
  redirect(`/crm/quotations/${quote.id}`)
}

export async function addProductToRequirement(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const requirementId = String(formData.get('requirement_id') || '')
  const productId = String(formData.get('product_id') || '')
  const quantity = Number(formData.get('quantity') || 1)
  if (!requirementId || !productId) return { error: 'Requirement and product are required' }
  const qty = quantity > 0 ? quantity : 1

  const { data: existing } = await supabase
    .from('requirement_products')
    .select('id, quantity')
    .eq('requirement_id', requirementId)
    .eq('product_id', productId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('requirement_products')
      .update({ quantity: qty })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('requirement_products').insert({
      requirement_id: requirementId,
      product_id: productId,
      quantity: qty,
    })
    if (error) return { error: error.message }
  }

  revalidatePath(`/crm/requirements/${requirementId}`)
  redirect(`/crm/requirements/${requirementId}?tab=products`)
}

export async function removeProductFromRequirement(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  const requirementId = String(formData.get('requirement_id') || '')
  if (!id || !requirementId) return { error: 'Product line is required' }

  const { error } = await supabase
    .from('requirement_products')
    .delete()
    .eq('id', id)
    .eq('requirement_id', requirementId)
  if (error) return { error: error.message }

  revalidatePath(`/crm/requirements/${requirementId}`)
  redirect(`/crm/requirements/${requirementId}?tab=products`)
}

export async function updateRequirementProductQty(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  const requirementId = String(formData.get('requirement_id') || '')
  const quantity = Number(formData.get('quantity') || 1)
  if (!id || !requirementId) return { error: 'Product line is required' }
  const qty = quantity > 0 ? quantity : 1

  const { error } = await supabase
    .from('requirement_products')
    .update({ quantity: qty })
    .eq('id', id)
    .eq('requirement_id', requirementId)
  if (error) return { error: error.message }

  revalidatePath(`/crm/requirements/${requirementId}`)
  redirect(`/crm/requirements/${requirementId}?tab=products`)
}

export async function updateRequirement(id: string, data: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('requirements').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/crm/requirements/${id}`)
  return { success: true }
}

export async function updateRequirementForm(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Requirement is required' }
  const budget = formData.get('budget') ? Number(formData.get('budget')) : null
  return updateRequirement(id, {
    name: String(formData.get('name') || '').trim(),
    quantity: Number(formData.get('quantity') || 1) || 1,
    budget,
    revenue_opportunity: budget || 0,
    deadline: String(formData.get('deadline') || '') || null,
    delivery_city: String(formData.get('delivery_city') || '') || null,
    purpose: String(formData.get('purpose') || '') || null,
    payment_terms: String(formData.get('payment_terms') || '') || null,
    description: String(formData.get('description') || '') || null,
    status: String(formData.get('status') || 'active'),
  })
}

export async function removeRequirement(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Requirement is required' }

  const [{ count: quotes }, { count: orders }] = await Promise.all([
    supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('requirement_id', id),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('requirement_id', id),
  ])
  if (quotes || orders) {
    const { error } = await supabase.from('requirements').update({ status: 'closed' }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/crm/requirements')
    revalidatePath(`/crm/requirements/${id}`)
    redirect(`/crm/requirements/${id}?removed=archived`)
  }

  const { error } = await supabase.from('requirements').delete().eq('id', id)
  if (error) {
    await supabase.from('requirements').update({ status: 'closed' }).eq('id', id)
    return { error: 'This requirement could not be deleted. It was closed instead.' }
  }
  revalidatePath('/crm/requirements')
  redirect('/crm/requirements')
}
