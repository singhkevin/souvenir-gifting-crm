import 'server-only'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { getProfile } from '@/lib/auth'
import { isBusinessRole } from '@/lib/roles'
import { companyCanUseCatalog, resolveShareCampaignId } from '@/lib/catalogs/rfq'
import { readTenantFromHeaders } from '@/lib/portal-host'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  directOrderSchemaHint,
  normalizeCheckout,
  type CheckoutLineInput,
} from '@/lib/catalogue/purchase-path'
import { storeSampleQuantityError } from '@/lib/catalogue/storefront'
import { notifyOrderPlaced } from '@/lib/email/order-emails'
import type { OrderSource } from '@/lib/orders/source'

export type DirectOrderResult = {
  error?: string
  success?: boolean
  orderId?: string
  orderNumber?: string
}

function clean(value: string | undefined) {
  return String(value || '').trim()
}

async function orderNumber(orderId: string) {
  const admin = createAdminClient()
  const client = admin || (await createClient())
  const { data } = await client.from('orders').select('order_number').eq('id', orderId).maybeSingle()
  return data?.order_number ? String(data.order_number) : null
}

function revalidateOrders(orderId: string) {
  revalidatePath('/portal/orders')
  revalidatePath(`/portal/orders/${orderId}`)
  revalidatePath('/crm/orders')
  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/portal/catalogue')
  revalidatePath('/catalogue')
}

async function callPlaceDirectOrder(
  caller: 'user' | 'service',
  args: {
    companyId: string
    contactId: string | null
    ownerId: string | null
    surface: 'store' | 'portal' | 'microsite' | 'catalog'
    campaignId: string | null
    lines: { productId: string; quantity: number }[]
    source?: OrderSource | null
  },
): Promise<DirectOrderResult> {
  const supabase = caller === 'service' ? createAdminClient() : await createClient()
  if (!supabase) return { error: 'Unable to place this order just now. Please try again shortly.' }

  const { data, error } = await supabase.rpc('place_direct_order', {
    p_company_id: args.companyId,
    p_contact_id: args.contactId,
    p_owner_id: args.ownerId,
    p_surface: args.surface,
    p_campaign_id: args.campaignId,
    p_lines: args.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
    p_source: args.source ?? null,
  })

  if (error || !data) {
    return { error: directOrderSchemaHint(error?.message || 'Unable to place this order') }
  }

  const orderId = String(data)
  revalidateOrders(orderId)
  await notifyOrderPlaced(orderId)
  return { success: true, orderId, orderNumber: (await orderNumber(orderId)) || undefined }
}

/** Logged-in portal client. Price and stock are decided in place_direct_order. */
export async function placeClientDirectOrder(input: {
  lines: CheckoutLineInput[]
  catalogId?: string | null
}): Promise<DirectOrderResult> {
  const normalized = normalizeCheckout(
    input.lines.map((line) => ({
      ...line,
      catalogId: input.catalogId === undefined ? line.catalogId : input.catalogId,
    })),
  )
  if ('error' in normalized) return { error: normalized.error }

  const profile = await getProfile()
  const isClient = profile?.role === 'client_admin' || profile?.role === 'client_user'
  if (!profile || !isClient) return { error: 'Sign in with your company account to buy' }

  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')
  if (!companyId) return { error: 'Company not found' }

  const catalogId = normalized.catalogId
  if (catalogId) {
    const allowed = await companyCanUseCatalog(supabase, catalogId, companyId)
    if (!allowed) return { error: 'This catalog is not assigned to your company' }
  }

  const tenant = readTenantFromHeaders(await headers())
  const surface = catalogId ? 'catalog' : tenant ? 'microsite' : 'portal'
  const source: OrderSource = surface === 'microsite' ? 'microsite' : 'portal'

  const [{ data: company }, { data: contact }] = await Promise.all([
    supabase.from('companies').select('owner_id').eq('id', companyId).maybeSingle(),
    profile.email
      ? supabase.from('contacts').select('id').eq('company_id', companyId).ilike('email', profile.email).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  let contactId = contact?.id ? String(contact.id) : null
  if (!contactId && profile.email) {
    const admin = createAdminClient()
    if (admin) {
      const inserted = await admin
        .from('contacts')
        .insert({
          company_id: companyId,
          full_name: profile.full_name || profile.email,
          email: profile.email,
          contact_type: 'primary',
          kind: 'corporate',
          notes: 'Added from a catalogue purchase.',
        })
        .select('id')
        .single()
      if (inserted.data?.id) contactId = String(inserted.data.id)
    }
  }

  return callPlaceDirectOrder('user', {
    companyId,
    contactId,
    ownerId: company?.owner_id ?? null,
    surface,
    campaignId: catalogId,
    lines: normalized.lines,
    source,
  })
}

/** Public catalogue guest checkout. Creates a prospect company, then the order. */
export async function placeStoreDirectOrder(input: {
  fullName?: string
  email?: string
  companyName?: string
  phone?: string
  fax?: string
  lines: CheckoutLineInput[]
}): Promise<DirectOrderResult> {
  if (clean(input.fax)) return { success: true }

  const normalizedSample = normalizeCheckout(input.lines.map((line) => ({ ...line, catalogId: null })))
  if ('error' in normalizedSample) return { error: normalizedSample.error }
  const sampleError = storeSampleQuantityError(normalizedSample.lines.map((line) => line.quantity))
  if (sampleError) return { error: sampleError }

  const profile = await getProfile()
  if (profile && isBusinessRole(profile.role) && profile.company_id) {
    return placeSignedInBusinessOrder(profile, input)
  }

  const fullName = clean(input.fullName)
  const email = clean(input.email).toLowerCase()
  const companyName = clean(input.companyName)
  const phone = clean(input.phone)
  if (!fullName) return { error: 'Please share your name.' }
  if (!email || !email.includes('@')) return { error: 'Please share a valid email.' }
  if (!companyName) return { error: 'Please share your company name.' }

  const normalized = normalizeCheckout(input.lines.map((line) => ({ ...line, catalogId: null })))
  if ('error' in normalized) return { error: normalized.error }

  const admin = createAdminClient()
  if (!admin) return { error: 'Unable to place this order just now. Please try again shortly.' }

  const { data: owner } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({
      name: companyName,
      status: 'prospect',
      owner_id: owner?.id || null,
      notes: 'Created from a public catalogue purchase.',
    })
    .select('id')
    .single()
  if (companyError || !company) return { error: 'Unable to place this order. Please try again.' }

  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .insert({
      company_id: company.id,
      full_name: fullName,
      email,
      phone: phone || null,
      contact_type: 'primary',
      kind: 'corporate',
      notes: 'Placed a public catalogue order.',
    })
    .select('id')
    .single()
  if (contactError || !contact) {
    await admin.from('companies').delete().eq('id', company.id)
    return { error: 'Unable to place this order. Please try again.' }
  }

  const placed = await callPlaceDirectOrder('service', {
    companyId: company.id,
    contactId: contact.id,
    ownerId: owner?.id || null,
    surface: 'store',
    campaignId: null,
    lines: normalized.lines,
    source: 'store',
  })
  if (placed.error) {
    await admin.from('contacts').delete().eq('id', contact.id)
    await admin.from('companies').delete().eq('id', company.id)
    return placed
  }
  return placed
}

async function placeSignedInBusinessOrder(
  profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>,
  input: {
    fullName?: string
    email?: string
    phone?: string
    lines: CheckoutLineInput[]
  },
): Promise<DirectOrderResult> {
  const normalized = normalizeCheckout(input.lines.map((line) => ({ ...line, catalogId: null })))
  if ('error' in normalized) return { error: normalized.error }

  const admin = createAdminClient()
  if (!admin || !profile.company_id) return { error: 'Unable to place this order just now. Please try again shortly.' }

  const { data: company } = await admin
    .from('companies')
    .select('id, owner_id')
    .eq('id', profile.company_id)
    .maybeSingle()
  if (!company) return { error: 'Unable to place this order. Please try again.' }

  const email = (clean(input.email) || profile.email).toLowerCase()
  const fullName = clean(input.fullName) || profile.full_name || email
  const phone = clean(input.phone)
  const { data: existing } = await admin
    .from('contacts')
    .select('id')
    .eq('company_id', company.id)
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  let contactId = existing?.id ? String(existing.id) : null
  if (!contactId) {
    const { data: contact, error } = await admin
      .from('contacts')
      .insert({
        company_id: company.id,
        full_name: fullName,
        email,
        phone: phone || null,
        contact_type: 'primary',
        kind: 'business',
        notes: 'Placed a store order from a business account.',
      })
      .select('id')
      .single()
    if (error || !contact) return { error: 'Unable to place this order. Please try again.' }
    contactId = String(contact.id)
  }

  return callPlaceDirectOrder('service', {
    companyId: company.id,
    contactId,
    ownerId: company.owner_id ?? null,
    surface: 'store',
    campaignId: null,
    lines: normalized.lines,
    source: 'business',
  })
}

export async function placeShareDirectOrder(input: {
  token: string
  lines: CheckoutLineInput[]
}): Promise<DirectOrderResult> {
  const campaignId = await resolveShareCampaignId(input.token)
  if (!campaignId) return { error: 'This catalog link is unavailable' }
  return placeClientDirectOrder({
    catalogId: campaignId,
    lines: input.lines.map((line) => ({ ...line, catalogId: campaignId })),
  })
}
