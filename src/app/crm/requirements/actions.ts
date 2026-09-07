'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { writeAudit } from '@/lib/audit'

export async function createRequirement(formData: FormData) {
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
  redirect(`/crm/requirements/${data.id}`)
}

export async function createRequirementFromLead(formData: FormData) {
  return createRequirement(formData)
}

export async function createQuotationFromRequirement(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const requirementId = String(formData.get('requirement_id') || '')
  if (!requirementId) return { error: 'Requirement is required' }

  const { data: req } = await supabase
    .from('requirements')
    .select('id, company_id, contact_id, owner_id, quantity')
    .eq('id', requirementId)
    .single()
  if (!req) return { error: 'Requirement not found' }

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
      status: 'draft',
      valid_until: validUntil.toISOString().slice(0, 10),
      notes: String(formData.get('notes') || '') || null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  const { data: reqProducts } = await supabase
    .from('requirement_products')
    .select('product_id, quantity, product:products(id, name, price)')
    .eq('requirement_id', req.id)

  if (reqProducts && reqProducts.length > 0) {
    const items = reqProducts.map((row) => {
      const product = Array.isArray(row.product) ? row.product[0] : row.product
      const qty = row.quantity || req.quantity || 1
      const unit = Number(product?.price || 0)
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
  }

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
  const requirementId = String(formData.get('requirement_id') || '')
  const productId = String(formData.get('product_id') || '')
  const quantity = Number(formData.get('quantity') || 1)
  if (!requirementId || !productId) return { error: 'Requirement and product are required' }

  const { error } = await supabase.from('requirement_products').insert({
    requirement_id: requirementId,
    product_id: productId,
    quantity: quantity > 0 ? quantity : 1,
  })
  if (error) return { error: error.message }
  revalidatePath(`/crm/requirements/${requirementId}`)
  return { success: true }
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
