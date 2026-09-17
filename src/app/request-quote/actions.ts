'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth'
import { isUuid } from '@/lib/utils'

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

export async function submitPublicQuote(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  if (clean(formData.get('fax'))) {
    return { success: true }
  }

  const fullName = clean(formData.get('full_name'))
  const email = clean(formData.get('email')).toLowerCase()
  const companyName = clean(formData.get('company_name'))
  const phone = clean(formData.get('phone'))
  const quantity = clean(formData.get('quantity'))
  const message = clean(formData.get('message'))
  const productId = clean(formData.get('product_id'))
  const productName = clean(formData.get('product_name'))
  const itemsRaw = clean(formData.get('items_json'))

  if (!fullName) return { error: 'Please share your name.' }
  if (!email || !email.includes('@')) return { error: 'Please share a valid work email.' }
  if (!companyName) return { error: 'Please share your company name.' }
  if (!message) return { error: 'Please tell us a little about the gifting need.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Unable to send this enquiry just now. Please try again shortly.' }

  const profile = await getProfile()
  if (profile && (profile.role === 'client_admin' || profile.role === 'client_user')) {
    // Existing clients already have a requirement flow in the portal.
    // We still record a website-sourced note on a lead so sales can see the catalogue context.
  }

  let productLine = ''
  let cartItems: { id: string; name: string; quantity: number }[] = []
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(itemsRaw)
      if (Array.isArray(parsed)) {
        cartItems = parsed
          .filter((row) => row && typeof row === 'object' && row.id && row.name)
          .map((row) => ({
            id: String(row.id),
            name: String(row.name),
            quantity: Math.max(1, Math.round(Number(row.quantity) || 1)),
          }))
      }
    } catch {
      cartItems = []
    }
  }

  if (cartItems.length) {
    const ids = cartItems.map((item) => item.id).filter((id) => isUuid(id))
    const { data: products } = ids.length
      ? await admin.from('products').select('id, name, sku').in('id', ids).eq('status', 'active').eq('catalogue_access', 'all')
      : { data: null }
    const bySku = new Map((products || []).map((p) => [p.id, p]))
    productLine =
      'Products:\n' +
      cartItems
        .map((item) => {
          const match = bySku.get(item.id)
          const label = match ? `${match.name} (${match.sku})` : item.name
          return `  - ${label} x ${item.quantity}`
        })
        .join('\n') +
      '\n'
  } else if (productId && isUuid(productId)) {
    const { data: product } = await admin
      .from('products')
      .select('id, name, sku')
      .eq('id', productId)
      .eq('status', 'active')
      .eq('catalogue_access', 'all')
      .maybeSingle()
    if (product) {
      productLine = `Product: ${product.name} (${product.sku})\n`
    }
  } else if (productName) {
    productLine = `Product: ${productName}\n`
  }

  const notes = [
    'Website catalogue enquiry',
    productLine.trim(),
    !cartItems.length && quantity ? `Quantity: ${quantity}` : '',
    message,
  ]
    .filter(Boolean)
    .join('\n')

  const { data: owner } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const { data: existingCompany } = await admin
    .from('companies')
    .select('id')
    .ilike('name', companyName)
    .limit(1)
    .maybeSingle()

  let companyId = existingCompany?.id as string | undefined
  if (!companyId) {
    const { data: created, error: companyError } = await admin
      .from('companies')
      .insert({
        name: companyName,
        status: 'prospect',
        owner_id: owner?.id || null,
        notes: 'Created from the public Souvenir - Gifting Solutions catalogue quote form.',
      })
      .select('id')
      .single()
    if (companyError || !created) {
      return { error: 'Unable to save this enquiry. Please try again.' }
    }
    companyId = created.id
  }

  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .insert({
      company_id: companyId,
      full_name: fullName,
      email,
      phone: phone || null,
      contact_type: 'primary',
      kind: 'corporate',
      notes: 'Submitted via the public catalogue.',
    })
    .select('id')
    .single()
  if (contactError || !contact) {
    return { error: 'Unable to save this enquiry. Please try again.' }
  }

  const { error: leadError } = await admin.from('leads').insert({
    company_id: companyId,
    contact_id: contact.id,
    owner_id: owner?.id || null,
    source: 'website',
    stage: 'cold',
    notes,
  })
  if (leadError) return { error: 'Unable to save this enquiry. Please try again.' }

  return { success: true }
}
