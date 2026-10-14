'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { isPresentationStaffRole } from '@/lib/roles'
import { withIdempotency } from '@/lib/idempotency'
import { isUuid } from '@/lib/utils'
import { getCompanyMarginPercent, sellPricesForSurface } from '@/lib/pricing/server'
import { cleanSpecs, expiryFromChoice, newShareToken, parseMoq, parseMoney } from '@/lib/presentations/rules'

const DENIED = 'You do not have access to presentations.'

type ProductSnap = {
  id: string
  name: string
  image_url: string | null
  description: string | null
  price: number
  moq: number | null
}

type DraftItem = {
  kind: 'product' | 'combo'
  productId: string | null
  productIds: string[]
  title: string
  specs: string
  price: number
  moq: number
}

async function requireStaff() {
  const profile = await getProfile()
  if (!profile || !profile.is_active || !isPresentationStaffRole(profile.role)) return null
  return profile
}

function parseDraft(raw: string, products: Map<string, ProductSnap>): { items: DraftItem[] } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw || '[]')
  } catch {
    return { error: 'Add at least one slide.' }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { error: 'Add at least one slide.' }
  const items: DraftItem[] = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') return { error: 'Add at least one slide.' }
    const row = entry as {
      kind?: string
      productId?: string
      productIds?: string[]
      title?: string
      specs?: string
      price?: unknown
      moq?: unknown
    }
    const kind = row.kind === 'combo' ? 'combo' : 'product'
    const title = String(row.title || '').trim()
    const price = parseMoney(row.price)
    const moq = parseMoq(row.moq)
    if (!title) return { error: 'Name each slide.' }
    if (price == null) return { error: 'Enter a price for each slide.' }
    if (moq == null) return { error: 'Enter an MOQ for each slide.' }
    if (kind === 'product') {
      const product = products.get(String(row.productId || ''))
      if (!product) return { error: 'One of the selected products is no longer available.' }
      items.push({
        kind,
        productId: product.id,
        productIds: [],
        title,
        specs: cleanSpecs(row.specs || product.description || ''),
        price,
        moq,
      })
    } else {
      const ids = [...new Set((row.productIds || []).map(String))].filter((id) => products.has(id))
      if (ids.length < 2) return { error: 'A combo needs at least two products.' }
      items.push({ kind, productId: null, productIds: ids, title, specs: cleanSpecs(row.specs || ''), price, moq })
    }
    if (items.length > 24) return { error: 'Keep the deck to 24 slides.' }
  }
  return { items }
}

function collectIds(raw: string) {
  try {
    const parsed = JSON.parse(raw || '[]') as { productId?: string; productIds?: string[] }[]
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row) => [row.productId, ...(row.productIds || [])].filter(Boolean) as string[])
  } catch {
    return []
  }
}

async function loadProducts(ids: string[]) {
  const supabase = await createClient()
  const unique = [...new Set(ids)].filter((id) => isUuid(id))
  if (!unique.length) return new Map<string, ProductSnap>()
  const { data } = await supabase
    .from('products')
    .select('id, name, image_url, description, price, moq')
    .in('id', unique)
  return new Map((data || []).map((row) => [row.id, row as ProductSnap]))
}

async function applyCompanyPrices(items: DraftItem[], companyId: string) {
  const ids = items.flatMap((item) => (item.productId ? [item.productId] : []))
  const margin = await getCompanyMarginPercent(companyId)
  const prices = await sellPricesForSurface(ids, 'business', margin, companyId)
  if (!prices) return items
  return items.map((item) => {
    if (!item.productId) return item
    const next = prices.get(item.productId)
    return next == null ? item : { ...item, price: next }
  })
}

async function insertItems(presentationId: string, items: DraftItem[], products: Map<string, ProductSnap>) {
  const supabase = await createClient()
  const created: string[] = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const image = item.kind === 'product'
      ? products.get(item.productId || '')?.image_url || null
      : products.get(item.productIds[0])?.image_url || null
    const members = item.productIds.map((id) => products.get(id)?.name || '').filter(Boolean)
    const { data, error } = await supabase
      .from('presentation_items')
      .insert({
        presentation_id: presentationId,
        kind: item.kind,
        product_id: item.productId,
        title: item.title,
        image_url: image,
        specs: item.specs,
        price: item.price,
        moq: item.moq,
        member_names: members,
        sort_order: index,
      })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message || 'Could not save the slides.' }
    created.push(data.id)
    if (item.kind === 'combo') {
      const { error: comboError } = await supabase.from('presentation_combo_products').insert(
        item.productIds.map((productId, sort) => ({ item_id: data.id, product_id: productId, sort_order: sort })),
      )
      if (comboError) return { error: comboError.message }
    }
  }
  return { ids: created }
}

function readHeader(formData: FormData) {
  const title = String(formData.get('title') || '').trim()
  const clientName = String(formData.get('client_name') || '').trim()
  const notes = String(formData.get('notes') || '').trim()
  const companyRaw = String(formData.get('company_id') || '')
  const companyId = isUuid(companyRaw) ? companyRaw : null
  if (!title) return { error: 'Name the presentation.' }
  if (!clientName) return { error: 'Enter the client name.' }
  return { title, clientName, notes, companyId, useCompany: formData.get('use_company_prices') === 'on' }
}

export async function createPresentation(formData: FormData) {
  return withIdempotency('crm.createPresentation', formData, () => createPresentationOnce(formData))
}

async function createPresentationOnce(formData: FormData) {
  const profile = await requireStaff()
  if (!profile) return { error: DENIED }
  const header = readHeader(formData)
  if ('error' in header) return header
  if (header.useCompany && !header.companyId) return { error: 'Choose a company to use its prices.' }

  const raw = String(formData.get('items_json') || '[]')
  const products = await loadProducts(collectIds(raw))
  const draft = parseDraft(raw, products)
  if ('error' in draft) return draft
  const items = header.useCompany && header.companyId
    ? await applyCompanyPrices(draft.items, header.companyId)
    : draft.items

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('presentations')
    .insert({
      title: header.title,
      client_name: header.clientName,
      notes: header.notes,
      company_id: header.companyId,
      created_by: profile.id,
    })
    .select('id')
    .single()
  if (error || !data) {
    if (error && /presentations|schema cache/i.test(error.message)) {
      return { error: 'Apply the presentations migration before creating a deck.' }
    }
    return { error: error?.message || 'Could not create the presentation.' }
  }
  const saved = await insertItems(data.id, items, products)
  if ('error' in saved) return saved
  revalidatePath('/crm/presentations')
  redirect(`/crm/presentations/${data.id}`)
}

export async function updatePresentation(formData: FormData) {
  return withIdempotency('crm.updatePresentation', formData, () => updatePresentationOnce(formData))
}

async function updatePresentationOnce(formData: FormData) {
  const profile = await requireStaff()
  if (!profile) return { error: DENIED }
  const id = String(formData.get('id') || '')
  if (!isUuid(id)) return { error: 'Presentation not found.' }
  const header = readHeader(formData)
  if ('error' in header) return header
  if (header.useCompany && !header.companyId) return { error: 'Choose a company to use its prices.' }

  const raw = String(formData.get('items_json') || '[]')
  const products = await loadProducts(collectIds(raw))
  const draft = parseDraft(raw, products)
  if ('error' in draft) return draft
  const items = header.useCompany && header.companyId
    ? await applyCompanyPrices(draft.items, header.companyId)
    : draft.items

  const supabase = await createClient()
  const { data: previous } = await supabase.from('presentation_items').select('id').eq('presentation_id', id)
  const { error } = await supabase
    .from('presentations')
    .update({
      title: header.title,
      client_name: header.clientName,
      notes: header.notes,
      company_id: header.companyId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }
  const saved = await insertItems(id, items, products)
  if ('error' in saved) return saved
  const oldIds = (previous || []).map((row) => row.id)
  if (oldIds.length) {
    await supabase.from('presentation_items').delete().in('id', oldIds)
  }
  revalidatePath(`/crm/presentations/${id}`)
  redirect(`/crm/presentations/${id}`)
}

async function insertLink(presentationId: string, expiresAt: string | null) {
  const supabase = await createClient()
  const token = newShareToken()
  const { error } = await supabase.from('presentation_links').insert({
    presentation_id: presentationId,
    token,
    expires_at: expiresAt,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function sharePresentation(formData: FormData) {
  return withIdempotency('crm.sharePresentation', formData, () => sharePresentationOnce(formData))
}

async function sharePresentationOnce(formData: FormData) {
  const profile = await requireStaff()
  if (!profile) return { error: DENIED }
  const id = String(formData.get('id') || '')
  if (!isUuid(id)) return { error: 'Presentation not found.' }
  const expiry = expiryFromChoice(String(formData.get('expiry') || ''), String(formData.get('expiry_date') || ''))
  if ('error' in expiry) return expiry
  const supabase = await createClient()
  await supabase
    .from('presentation_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('presentation_id', id)
    .is('revoked_at', null)
  const saved = await insertLink(id, expiry.expiresAt)
  if ('error' in saved) return saved
  revalidatePath(`/crm/presentations/${id}`)
  return { ok: true }
}

export async function revokePresentationLink(formData: FormData) {
  return withIdempotency('crm.revokePresentation', formData, async () => {
    const profile = await requireStaff()
    if (!profile) return { error: DENIED }
    const id = String(formData.get('id') || '')
    if (!isUuid(id)) return { error: 'Presentation not found.' }
    const supabase = await createClient()
    const { error } = await supabase
      .from('presentation_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('presentation_id', id)
      .is('revoked_at', null)
    if (error) return { error: error.message }
    revalidatePath(`/crm/presentations/${id}`)
    return { ok: true }
  })
}
