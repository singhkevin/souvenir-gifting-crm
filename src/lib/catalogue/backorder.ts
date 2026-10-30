import 'server-only'

import { resolveAlertOwnerId } from '@/lib/alerts/owner'
import { pickReusableStoreContact, resolveStoreOrderOwnerId, type StoreContactMatch } from '@/lib/catalogue/store-prospect'
import { createAdminClient } from '@/lib/supabase/admin'

export type BackorderLine = {
  productId: string
  quantity: number
  name: string
  sku: string | null
}

export type BackorderResult = {
  error?: string
  backorderId?: string
  requirementId?: string
}

function clean(value: string | undefined) {
  return String(value || '').trim()
}

export function parseNeededBy(value: string | undefined): { error: string } | { date: string | null } {
  const text = clean(value)
  if (!text) return { date: null }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: 'Needed by must be a date.' }
  const [year, month, day] = text.split('-').map((part) => Number(part))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { error: 'Needed by must be a date.' }
  }
  return { date: text }
}

function migrationError(message: string) {
  if (/store_backorder|requirements_source_check|schema cache/i.test(message)) {
    return 'Arrangement requests need supabase/migrations/20261030_store_backorders.sql. Apply it, then try again.'
  }
  return null
}

async function storeOwnerId(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data: firstAdmin } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  const settings = await admin.from('org_settings').select('store_default_owner_id').limit(1).maybeSingle()
  const configured = !settings.error && settings.data?.store_default_owner_id
    ? String(settings.data.store_default_owner_id)
    : null
  let active = false
  if (configured) {
    const { data: profile } = await admin.from('profiles').select('is_active').eq('id', configured).maybeSingle()
    active = profile ? Boolean(profile.is_active) : false
  }
  return resolveStoreOrderOwnerId({
    configuredOwnerId: configured,
    configuredOwnerActive: active,
    firstAdminId: firstAdmin?.id || null,
  })
}

/**
 * One arrangement request for the out-of-stock lines, plus a requirement
 * so staff can quote it from the existing pipeline.
 */
export async function createStoreBackorder(input: {
  fullName?: string
  email?: string
  companyName?: string
  phone?: string
  neededBy?: string
  note?: string
  notifyStock?: boolean
  orderId?: string | null
  lines: BackorderLine[]
}): Promise<BackorderResult> {
  const needed = parseNeededBy(input.neededBy)
  if ('error' in needed) return { error: needed.error }

  const fullName = clean(input.fullName)
  const email = clean(input.email).toLowerCase()
  const companyName = clean(input.companyName) || fullName
  const phone = clean(input.phone)
  const note = clean(input.note).slice(0, 2000)
  if (!fullName) return { error: 'Please share your name.' }
  if (!email || !email.includes('@')) return { error: 'Please share a valid email.' }
  if (!companyName) return { error: 'Please share your company name.' }
  if (!input.lines.length) return { error: 'Nothing to arrange.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Unable to save this request just now. Please try again shortly.' }

  const ownerId = await storeOwnerId(admin)

  let companyId = ''
  let contactId = ''
  if (input.orderId) {
    const { data: order } = await admin
      .from('orders')
      .select('company_id, contact_id')
      .eq('id', input.orderId)
      .maybeSingle()
    if (order?.company_id) {
      companyId = String(order.company_id)
      contactId = order.contact_id ? String(order.contact_id) : ''
    }
  }

  if (!companyId) {
  const lookup = await admin
    .from('contacts')
    .select('id, company_id, company:companies(id, status, notes)')
    .ilike('email', email)
    .order('created_at', { ascending: true })
  if (lookup.error) return { error: 'Unable to save this request. Please try again.' }
  const reusable = pickReusableStoreContact((lookup.data || []) as StoreContactMatch[])

  companyId = reusable?.company_id ? String(reusable.company_id) : ''
  contactId = reusable?.id ? String(reusable.id) : ''

  if (!reusable) {
    const { data: company, error: companyError } = await admin
      .from('companies')
      .insert({
        name: companyName,
        status: 'prospect',
        owner_id: ownerId,
        notes: 'Created from a public catalogue arrangement request.',
      })
      .select('id')
      .single()
    if (companyError || !company) return { error: 'Unable to save this request. Please try again.' }
    companyId = company.id

    const { data: contact, error: contactError } = await admin
      .from('contacts')
      .insert({
        company_id: company.id,
        full_name: fullName,
        email,
        phone: phone || null,
        contact_type: 'primary',
        kind: 'corporate',
        notes: 'Asked the store to arrange products that were not in stock.',
      })
      .select('id')
      .single()
    if (contactError || !contact) {
      await admin.from('companies').delete().eq('id', company.id)
      return { error: 'Unable to save this request. Please try again.' }
    }
    contactId = contact.id

    const { error: leadError } = await admin.from('leads').insert({
      company_id: company.id,
      contact_id: contact.id,
      owner_id: ownerId,
      source: 'website',
      stage: 'warm',
      notes: 'Public catalogue arrangement request.',
    })
    if (leadError) {
      await admin.from('contacts').delete().eq('id', contact.id)
      await admin.from('companies').delete().eq('id', company.id)
      return { error: 'Unable to save this request. Please try again.' }
    }
  }
  }

  const summary = input.lines.map((line) => line.name).join(', ').slice(0, 140)
  const quantity = input.lines.reduce((sum, line) => sum + line.quantity, 0)
  const description = [
    'Retail store arrangement. These lines were not in stock at checkout.',
    note ? `Note: ${note}` : null,
    input.orderId ? 'In-stock lines from the same checkout were placed as an order.' : null,
  ].filter(Boolean).join('\n')

  const { data: requirement, error: requirementError } = await admin
    .from('requirements')
    .insert({
      name: `Store arrangement: ${summary}`.slice(0, 180),
      company_id: companyId,
      contact_id: contactId || null,
      owner_id: ownerId,
      quantity,
      deadline: needed.date,
      description,
      status: 'active',
      source: 'store_backorder',
    })
    .select('id')
    .single()
  if (requirementError || !requirement) {
    return { error: migrationError(requirementError?.message || '') || 'Unable to save this request. Please try again.' }
  }

  const { error: lineError } = await admin.from('requirement_products').insert(
    input.lines.map((line) => ({
      requirement_id: requirement.id,
      product_id: line.productId,
      quantity: line.quantity,
    })),
  )
  if (lineError) {
    console.error('[backorder] requirement lines', lineError.message)
  }

  const { data: request, error: requestError } = await admin
    .from('store_backorder_requests')
    .insert({
      requirement_id: requirement.id,
      order_id: input.orderId || null,
      company_id: companyId,
      contact_id: contactId || null,
      full_name: fullName,
      email,
      phone: phone || null,
      company_name: companyName,
      needed_by: needed.date,
      note: note || null,
      notify_opt_in: Boolean(input.notifyStock),
      status: 'open',
    })
    .select('id')
    .single()
  if (requestError || !request) {
    return { error: migrationError(requestError?.message || '') || 'Unable to save this request. Please try again.' }
  }

  const { error: backorderLinesError } = await admin.from('store_backorder_lines').insert(
    input.lines.map((line) => ({
      request_id: request.id,
      product_id: line.productId,
      quantity: line.quantity,
      product_name: line.name,
      sku: line.sku,
    })),
  )
  if (backorderLinesError) {
    return { error: migrationError(backorderLinesError.message) || 'Unable to save this request. Please try again.' }
  }

  if (input.notifyStock) {
    for (const line of input.lines) {
      const inserted = await admin.from('store_stock_alerts').insert({
        product_id: line.productId,
        email,
        full_name: fullName,
        backorder_request_id: request.id,
        status: 'pending',
      })
      if (inserted.error && inserted.error.code !== '23505') {
        console.error('[backorder] stock alert', inserted.error.message)
      }
    }
  }

  const alertOwnerId = await resolveAlertOwnerId(admin, ownerId)
  if (alertOwnerId) {
    const noteRow = {
      user_id: alertOwnerId,
      audience: 'internal',
      title: 'Store arrangement request',
      body: `${fullName} asked to arrange ${summary}.`,
      link: `/crm/backorders/${request.id}`,
    }
    const inserted = await admin.from('notifications').insert(noteRow)
    if (inserted.error) {
      await admin.from('notifications').insert({
        user_id: noteRow.user_id,
        title: noteRow.title,
        body: noteRow.body,
        link: noteRow.link,
      })
    }
  }

  return { backorderId: String(request.id), requirementId: String(requirement.id) }
}
