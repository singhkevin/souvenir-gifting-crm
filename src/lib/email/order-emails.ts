import 'server-only'

import { sendEmail } from '@/lib/email/resend'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { isOrderSource, type OrderSource } from '@/lib/orders/source'
import { newPublicOrderToken } from '@/lib/orders/public-token'
import { adminOrigin, portalUrlForSlug } from '@/lib/portal-host'
import { storePublicOrigin } from '@/lib/site/store-public-origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, oneRelation } from '@/lib/utils'

const STAGE_EMAIL: Record<string, string> = {
  procurement: 'Confirmed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function deliver(to: string | null | undefined, subject: string, html: string) {
  if (!to || !to.includes('@')) return
  try {
    const result = await sendEmail({ to, subject, html })
    if (result.error) console.error('[order-email]', subject, result.error)
  } catch (error) {
    console.error('[order-email]', subject, error instanceof Error ? error.message : error)
  }
}

type OrderItem = {
  description?: string | null
  quantity?: number | null
  line_total?: number | null
  product?: { name?: string | null } | { name?: string | null }[] | null
}

type LoadedOrder = {
  id: string
  order_number?: string | null
  order_value?: number | null
  status?: string | null
  source?: string | null
  owner_id?: string | null
  company_id?: string | null
  tracking_number?: string | null
  public_token_hash?: string | null
  company?: { name?: string | null; account_type?: string | null; portal_slug?: string | null } | { name?: string | null; account_type?: string | null; portal_slug?: string | null }[] | null
  contact?: { email?: string | null; full_name?: string | null } | { email?: string | null; full_name?: string | null }[] | null
  items?: OrderItem[] | null
}

async function loadOrder(orderId: string) {
  const admin = createAdminClient()
  if (!admin) return null
  const { data, error } = await admin
    .from('orders')
    .select(`
      id, order_number, order_value, status, source, owner_id, company_id, tracking_number, public_token_hash,
      company:companies(name, account_type, portal_slug),
      contact:contacts(email, full_name),
      items:order_items(description, quantity, line_total, product:products(name))
    `)
    .eq('id', orderId)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[order-email] load', error.message)
    return null
  }
  return { admin, order: data as LoadedOrder }
}

async function staffRecipient(admin: NonNullable<ReturnType<typeof createAdminClient>>, ownerId: string | null | undefined) {
  if (ownerId) {
    const { data } = await admin.from('profiles').select('email').eq('id', ownerId).maybeSingle()
    if (data?.email) return String(data.email)
  }
  const { data: settings } = await admin.from('org_settings').select('business_default_owner_id').limit(1).maybeSingle()
  const fallback = settings?.business_default_owner_id ? String(settings.business_default_owner_id) : ''
  if (!fallback) return null
  const { data } = await admin.from('profiles').select('email').eq('id', fallback).maybeSingle()
  return data?.email ? String(data.email) : null
}

function itemLines(items: OrderItem[] | null | undefined) {
  return (items || []).map((item) => {
    const product = oneRelation(item.product)
    const name = product?.name || item.description || 'Item'
    const qty = item.quantity ?? 0
    const total = item.line_total != null ? ` — ${formatCurrency(item.line_total)}` : ''
    return `<li>${escapeHtml(name)} × ${qty}${escapeHtml(total)}</li>`
  }).join('')
}

async function customerStatusLink(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  order: LoadedOrder,
) {
  const source: OrderSource = isOrderSource(order.source) ? order.source : 'crm'
  const number = order.order_number || order.id
  if (source === 'store') {
    if (order.public_token_hash) return null
    const minted = newPublicOrderToken()
    const { error } = await admin
      .from('orders')
      .update({ public_token_hash: minted.hash })
      .eq('id', order.id)
      .is('public_token_hash', null)
    if (error) {
      console.error('[order-email] token', error.message)
      return null
    }
    return `${storePublicOrigin(null)}/orders/${encodeURIComponent(number)}?t=${encodeURIComponent(minted.token)}`
  }
  const company = oneRelation(order.company)
  if (source === 'business' || company?.account_type === 'business') {
    return `${storePublicOrigin(null)}/business/orders/${order.id}`
  }
  const portal = portalUrlForSlug(company?.portal_slug)
  if (portal) return `${portal}/portal/orders/${order.id}`
  return null
}

export async function orderPlacedCustomerEmail(orderId: string) {
  try {
    const loaded = await loadOrder(orderId)
    if (!loaded) return
    const { admin, order } = loaded
    const contact = oneRelation(order.contact)
    const number = order.order_number || order.id
    const link = await customerStatusLink(admin, order)
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1B2430;">
        <h1 style="font-size:20px;">Order ${escapeHtml(number)} received</h1>
        <p style="font-size:14px;line-height:1.6;color:#5C6570;">
          We'll confirm and share an invoice; no online payment yet.
        </p>
        <ul style="font-size:14px;line-height:1.6;padding-left:18px;">${itemLines(order.items)}</ul>
        <p style="font-size:14px;"><strong>Total ${escapeHtml(formatCurrency(order.order_value || 0))}</strong></p>
        ${link ? `<p style="margin:24px 0;"><a href="${escapeHtml(link)}" style="background:#806A50;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">View order status</a></p>` : ''}
      </div>
    `
    await deliver(contact?.email, `We received order ${number}`, html)
  } catch (error) {
    console.error('[order-email] customer', orderId, error instanceof Error ? error.message : error)
  }
}

export async function orderPlacedStaffEmail(orderId: string) {
  try {
    const loaded = await loadOrder(orderId)
    if (!loaded) return
    const { admin, order } = loaded
    const to = await staffRecipient(admin, order.owner_id)
    const company = oneRelation(order.company)
    const number = order.order_number || order.id
    const source = isOrderSource(order.source) ? order.source : 'crm'
    const link = `${adminOrigin(null)}/crm/orders/${order.id}`
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1B2430;">
        <h1 style="font-size:20px;">New ${escapeHtml(source)} order ${escapeHtml(number)}</h1>
        <p style="font-size:14px;line-height:1.6;">${escapeHtml(company?.name || 'A customer')} placed an order.</p>
        <ul style="font-size:14px;line-height:1.6;padding-left:18px;">${itemLines(order.items)}</ul>
        <p style="font-size:14px;"><strong>Total ${escapeHtml(formatCurrency(order.order_value || 0))}</strong></p>
        <p style="margin:24px 0;"><a href="${escapeHtml(link)}" style="background:#806A50;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Open in CRM</a></p>
      </div>
    `
    await deliver(to, `New order ${number}`, html)
  } catch (error) {
    console.error('[order-email] staff', orderId, error instanceof Error ? error.message : error)
  }
}

export async function orderStageChangedCustomerEmail(orderId: string, status: string) {
  const label = STAGE_EMAIL[status]
  if (!label) return
  try {
    const loaded = await loadOrder(orderId)
    if (!loaded) return
    const { admin, order } = loaded
    const contact = oneRelation(order.contact)
    const number = order.order_number || order.id
    const link = await customerStatusLink(admin, order)
    const tracking = status === 'dispatched' && order.tracking_number
      ? `<p style="font-size:14px;">Tracking number: <strong>${escapeHtml(order.tracking_number)}</strong></p>`
      : ''
    const stageText = status === 'procurement'
      ? 'Confirmed'
      : (CLIENT_STATUS_LABELS[status] || label)
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1B2430;">
        <h1 style="font-size:20px;">Order ${escapeHtml(number)} — ${escapeHtml(stageText)}</h1>
        ${tracking}
        ${link
          ? `<p style="margin:24px 0;"><a href="${escapeHtml(link)}" style="background:#806A50;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">View order status</a></p>`
          : '<p style="font-size:14px;line-height:1.6;color:#5C6570;">Use the status link from your order confirmation.</p>'}
      </div>
    `
    await deliver(contact?.email, `Order ${number} is ${label.toLowerCase()}`, html)
  } catch (error) {
    console.error('[order-email] stage', orderId, error instanceof Error ? error.message : error)
  }
}

export async function notifyOrderPlaced(orderId: string, options?: { includeStaff?: boolean }) {
  await orderPlacedCustomerEmail(orderId)
  if (options?.includeStaff === false) return
  await orderPlacedStaffEmail(orderId)
}

export async function businessPendingVerificationEmail(companyId: string, companyName: string) {
  try {
    const admin = createAdminClient()
    if (!admin) return
    const to = await staffRecipient(admin, null)
    const link = `${adminOrigin(null)}/crm/companies/${companyId}`
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1B2430;">
        <h1 style="font-size:20px;">New business account to verify</h1>
        <p style="font-size:14px;line-height:1.6;">${escapeHtml(companyName)} registered and is waiting for approval.</p>
        <p style="margin:24px 0;"><a href="${escapeHtml(link)}" style="background:#806A50;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Open company</a></p>
      </div>
    `
    await deliver(to, 'New business account to verify', html)
  } catch (error) {
    console.error('[order-email] business pending', companyId, error instanceof Error ? error.message : error)
  }
}
