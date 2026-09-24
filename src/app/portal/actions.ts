'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createPortalRequirement(formData: {
  name: string
  purpose: string
  description: string
  budget_per_unit: string
  quantity: string
  deadline: string
  delivery_city: string
  products: string[]
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

  // Attach only SKUs this client can already see.
  if (formData.products?.length && requirement) {
    const { data: products } = await supabase
      .from('client_products')
      .select('id, sku')
      .in('sku', formData.products)

    if (products && products.length > 0) {
      const { error: linkError } = await admin.from('requirement_products').insert(
        products.map(p => ({ requirement_id: requirement.id, product_id: p.id }))
      )
      if (linkError) return { error: linkError.message }
    }
  }

  return { success: true, id: requirement?.id }
}

export async function respondToQuotation(quotationId: string, status: 'accepted' | 'rejected', comment?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify ownership
  const { data: companyId } = await supabase.rpc('client_company_id')
  const { data: quotation } = await supabase
    .from('quotations')
    .select('company_id, status')
    .eq('id', quotationId)
    .single()

  if (!quotation || quotation.company_id !== companyId) {
    return { error: 'Quotation not found' }
  }
  if (quotation.status !== 'sent') {
    return { error: 'Quotation cannot be responded to in its current state' }
  }

  const { error } = await supabase.rpc('client_respond_quotation', {
    p_quotation_id: quotationId,
    p_status: status,
    p_comment: comment || null,
  })

  if (error) return { error: error.message }
  return { success: true }
}
