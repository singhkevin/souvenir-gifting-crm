'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/utils'
import { withIdempotency } from '@/lib/idempotency'
import {
  cleanRfqDeadline,
  cleanRfqNotes,
  companyCanUseCatalog,
  expandCatalogRfqLines,
  insertCatalogRequirement,
  loadPublishedCatalogLines,
  parseRfqSelection,
  rfqSchemaHint,
} from '@/lib/catalogs/rfq'

async function createPortalRequirementOnce(formData: {
  name: string
  purpose: string
  description: string
  budget_per_unit: string
  quantity: string
  deadline: string
  delivery_city: string
  products: string[]
  lines?: { sku: string; quantity: number }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get client's company
  const { data: companyId } = await supabase.rpc('client_company_id')
  if (!companyId) return { error: 'Company not found' }

  if (!formData.name?.trim()) return { error: 'Requirement name is required' }

  const budget = formData.budget_per_unit ? parseFloat(formData.budget_per_unit) : null
  const quantity = formData.quantity ? parseInt(formData.quantity, 10) : null
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return { error: 'Budget must be a positive number' }
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) return { error: 'Quantity must be a positive whole number' }

  // A client user must never own a requirement, or it disappears from the sales
  // pipeline's owner filters. Route ownership to the account manager instead.
  const { data: company } = await supabase
    .from('companies')
    .select('owner_id')
    .eq('id', companyId)
    .maybeSingle()

  // Clients may read their requirements, but insert is staff-only under RLS.
  // Write with the service role after the company check above.
  const admin = createAdminClient()
  if (!admin) return { error: 'Unable to save this requirement just now. Please try again shortly.' }

  const { data: requirement, error } = await admin
    .from('requirements')
    .insert({
      name: formData.name.trim(),
      company_id: companyId,
      owner_id: company?.owner_id ?? null,
      purpose: formData.purpose,
      description: formData.description,
      budget: budget,
      quantity: quantity,
      deadline: formData.deadline || null,
      delivery_city: formData.delivery_city || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const requested = (formData.lines?.length
    ? formData.lines
    : (formData.products || []).map((sku) => ({ sku, quantity: 1 }))
  ).filter((line) => line.sku)

  if (requested.length && requirement) {
    for (const line of requested) {
      const qty = Number(line.quantity)
      if (!Number.isInteger(qty) || qty < 1 || qty > 100000) {
        await admin.from('requirements').delete().eq('id', requirement.id)
        return { error: 'Each product quantity must be a whole number from 1 to 100000' }
      }
    }

    const skus = [...new Set(requested.map((line) => line.sku))]
    const { data: products } = await supabase
      .from('client_products')
      .select('id, sku')
      .in('sku', skus)

    if (!products?.length) {
      if (formData.lines?.length) {
        await admin.from('requirements').delete().eq('id', requirement.id)
        return { error: 'None of the selected products are available on your catalogue' }
      }
    } else {
      const qtyBySku = new Map<string, number>()
      for (const line of requested) {
        qtyBySku.set(line.sku, (qtyBySku.get(line.sku) || 0) + Number(line.quantity))
      }
      const { error: linkError } = await admin.from('requirement_products').insert(
        products.map((product) => ({
          requirement_id: requirement.id,
          product_id: product.id,
          quantity: qtyBySku.get(product.sku) || 1,
        })),
      )
      if (linkError) {
        await admin.from('requirements').delete().eq('id', requirement.id)
        return { error: rfqSchemaHint(linkError.message) }
      }
    }
  }

  revalidatePath('/portal/requirements')
  revalidatePath('/crm/requirements')
  return { success: true, id: requirement?.id }
}

async function requestCatalogQuotationOnce(input: {
  catalogId: string
  deadline: string
  notes: string
  lines: { id: string; quantity: number }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!isUuid(input.catalogId)) return { error: 'Catalog not found' }

  const selected = parseRfqSelection(input.lines)
  if (!selected) return { error: 'Select at least one product and a whole-number quantity' }
  const deadline = cleanRfqDeadline(input.deadline)
  if ('error' in deadline) return deadline

  const { data: companyId } = await supabase.rpc('client_company_id')
  if (!companyId) return { error: 'Company not found' }
  const allowed = await companyCanUseCatalog(supabase, input.catalogId, companyId)
  if (!allowed) return { error: 'This catalog is not assigned to your company' }

  const [{ data: catalog }, rows, { data: company }] = await Promise.all([
    supabase.from('campaigns').select('id, name').eq('id', input.catalogId).maybeSingle(),
    loadPublishedCatalogLines(supabase, input.catalogId),
    supabase.from('companies').select('owner_id').eq('id', companyId).maybeSingle(),
  ])
  if (!catalog?.name) return { error: 'Catalog not found' }

  const expanded = expandCatalogRfqLines(rows, selected)
  if (expanded.error || !expanded.lines) return { error: expanded.error || 'Select at least one product' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Unable to save this requirement just now. Please try again shortly.' }

  const saved = await insertCatalogRequirement(admin, {
    companyId,
    ownerId: company?.owner_id ?? null,
    campaignId: input.catalogId,
    catalogName: catalog.name,
    notes: cleanRfqNotes(input.notes),
    deadline: deadline.deadline,
    lines: expanded.lines,
  })
  if (saved.error) return { error: saved.error }

  revalidatePath('/portal/requirements')
  revalidatePath('/crm/requirements')
  revalidatePath('/portal/catalogue')
  return { success: true, id: saved.id }
}

export async function createPortalRequirement(
  input: Parameters<typeof createPortalRequirementOnce>[0] & { idempotencyKey?: string },
) {
  return withIdempotency('portal.createRequirement', input.idempotencyKey, () => createPortalRequirementOnce(input))
}

export async function requestCatalogQuotation(
  input: Parameters<typeof requestCatalogQuotationOnce>[0] & { idempotencyKey?: string },
) {
  return withIdempotency('portal.requestCatalogQuotation', input.idempotencyKey, () => requestCatalogQuotationOnce(input))
}

export async function respondToQuotation(
  quotationId: string,
  status: 'accepted' | 'rejected',
  comment?: string,
  acceptedItemIds?: string[],
  idempotencyKey?: string,
) {
  return withIdempotency('portal.respondToQuotation', idempotencyKey, () =>
    respondToQuotationOnce(quotationId, status, comment, acceptedItemIds),
  )
}

async function respondToQuotationOnce(
  quotationId: string,
  status: 'accepted' | 'rejected',
  comment?: string,
  acceptedItemIds?: string[],
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify ownership
  const { data: companyId } = await supabase.rpc('client_company_id')
  const { data: quotation } = await supabase
    .from('quotations')
    .select('company_id, status, requirement_id')
    .eq('id', quotationId)
    .single()

  if (!quotation || quotation.company_id !== companyId) {
    return { error: 'Quotation not found' }
  }
  // A repeat of a response that already went through is passed on: client_respond_quotation
  // returns the same outcome (the existing order for accepts) instead of an error or a second order.
  const repeatOfResponse = quotation.status === status
  if (!['sent', 'viewed'].includes(quotation.status || '') && !repeatOfResponse) {
    return { error: 'Quotation cannot be responded to in its current state' }
  }
  if (status === 'accepted') {
    if (!acceptedItemIds?.length || acceptedItemIds.some((id) => !isUuid(id))) {
      return { error: 'Select at least one line to accept' }
    }
  }

  const { error } = await supabase.rpc('client_respond_quotation', {
    p_quotation_id: quotationId,
    p_status: status,
    p_comment: comment || null,
    p_accepted_item_ids: status === 'accepted' ? acceptedItemIds : null,
  })

  if (error) return { error: rfqSchemaHint(error.message) }

  revalidatePath('/portal/quotations')
  revalidatePath(`/portal/quotations/${quotationId}`)
  revalidatePath('/portal/orders')
  revalidatePath('/crm/orders')
  revalidatePath('/crm/quotations')
  revalidatePath(`/crm/quotations/${quotationId}`)
  if (quotation.requirement_id) {
    revalidatePath(`/crm/requirements/${quotation.requirement_id}`)
  }
  return { success: true }
}
