'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
  const sellingPrice = Number(formData.get('selling_price') || 0)
  if (!campaignId || !productId) return { error: 'Campaign and product are required' }

  const { data: product } = await supabase
    .from('products')
    .select('name, description, image_url, price, moq, status')
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle()
  if (!product) return { error: 'Choose an active catalogue product' }

  const { error } = await supabase.from('campaign_products').insert({
    campaign_id: campaignId,
    product_id: productId,
    display_name: product.name,
    client_description: product.description,
    client_image_url: product.image_url,
    selling_price: sellingPrice || product.price || 0,
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
