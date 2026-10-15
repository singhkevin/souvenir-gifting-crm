'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { isGiftStaffRole } from '@/lib/roles'
import { parseAllowedEmailDomains } from '@/lib/pricing/domains'
import { withIdempotency } from '@/lib/idempotency'
import { giftDomainListProblem, giftWindowProblem, parseSizeOptions } from '@/lib/gifts/rules'
import { isUuid } from '@/lib/utils'

const STAFF_DENIED = 'You do not have access to gift selection.'

type ProductSnap = { id: string; name: string; image_url: string | null }

type DraftItem = {
  kind: 'product' | 'combo'
  productId: string | null
  productIds: string[]
  title: string
  sizeOptions: string[]
}

async function requireGiftStaff() {
  const profile = await getProfile()
  if (!profile || !profile.is_active || !isGiftStaffRole(profile.role)) return null
  return profile
}

function windowIso(opensRaw: string, closesRaw: string) {
  const problem = giftWindowProblem(opensRaw, closesRaw)
  if (problem) return { error: problem }
  const opens = new Date(opensRaw)
  const closes = new Date(closesRaw)
  if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime())) {
    return { error: 'Enter an open date and a close date.' }
  }
  return { opens: opens.toISOString(), closes: closes.toISOString() }
}

function parseDraftItems(raw: string, products: Map<string, ProductSnap>): { items: DraftItem[] } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw || '[]')
  } catch {
    return { error: 'Choose at least one gift.' }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { error: 'Choose at least one gift.' }
  const items: DraftItem[] = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') return { error: 'Choose at least one gift.' }
    const row = entry as { kind?: string; productId?: string; productIds?: string[]; title?: string; sizeOptions?: string[] }
    const kind = row.kind === 'combo' ? 'combo' : 'product'
    const sizeOptions = Array.isArray(row.sizeOptions)
      ? parseSizeOptions(row.sizeOptions.join(','))
      : []
    if (kind === 'product') {
      const product = products.get(String(row.productId || ''))
      if (!product) return { error: 'One of the selected products is no longer available.' }
      items.push({
        kind,
        productId: product.id,
        productIds: [],
        title: product.name,
        sizeOptions,
      })
    } else {
      const ids = [...new Set((row.productIds || []).map(String))].filter((id) => products.has(id))
      const title = String(row.title || '').trim()
      if (!title) return { error: 'Name each combo.' }
      if (ids.length < 2) return { error: 'A combo needs at least two products.' }
      items.push({ kind, productId: null, productIds: ids, title, sizeOptions })
    }
    if (items.length > 40) return { error: 'Keep the list to 40 gifts.' }
  }
  return { items }
}

async function loadProducts(ids: string[]) {
  const supabase = await createClient()
  const unique = [...new Set(ids)].filter((id) => isUuid(id))
  if (unique.length === 0) return new Map<string, ProductSnap>()
  const { data } = await supabase.from('products').select('id, name, image_url').in('id', unique)
  return new Map((data || []).map((row) => [row.id, row as ProductSnap]))
}

function collectProductIds(raw: string) {
  try {
    const parsed = JSON.parse(raw || '[]') as { productId?: string; productIds?: string[] }[]
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row) => [row.productId, ...(row.productIds || [])].filter(Boolean) as string[])
  } catch {
    return []
  }
}

async function insertItems(selectionId: string, items: DraftItem[], products: Map<string, ProductSnap>) {
  const supabase = await createClient()
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const image = item.kind === 'product'
      ? products.get(item.productId || '')?.image_url || null
      : products.get(item.productIds[0])?.image_url || null
    const members = item.productIds.map((id) => products.get(id)?.name || '').filter(Boolean)
    const { data, error } = await supabase
      .from('gift_selection_items')
      .insert({
        selection_id: selectionId,
        kind: item.kind,
        product_id: item.productId,
        title: item.title,
        image_url: image,
        member_names: members,
        size_options: item.sizeOptions,
        sort_order: index,
      })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message || 'Could not save the gift list.' }
    if (item.kind === 'combo') {
      const { error: comboError } = await supabase.from('gift_selection_combo_products').insert(
        item.productIds.map((productId, sort) => ({ item_id: data.id, product_id: productId, sort_order: sort })),
      )
      if (comboError) return { error: comboError.message }
    }
  }
  return { ok: true }
}

export async function createGiftSelection(formData: FormData) {
  return withIdempotency('crm.createGiftSelection', formData, () => createGiftSelectionOnce(formData))
}

async function createGiftSelectionOnce(formData: FormData) {
  const profile = await requireGiftStaff()
  if (!profile) return { error: STAFF_DENIED }
  const companyId = String(formData.get('company_id') || '')
  const name = String(formData.get('name') || '').trim()
  if (!isUuid(companyId)) return { error: 'Choose a company.' }
  if (!name) return { error: 'Name the gift selection.' }
  const domains = parseAllowedEmailDomains(String(formData.get('allowed_email_domains') || ''))
  const domainError = giftDomainListProblem(domains)
  if (domainError) return { error: domainError }
  const window = windowIso(String(formData.get('opens_at') || ''), String(formData.get('closes_at') || ''))
  if ('error' in window) return window

  const rawItems = String(formData.get('items_json') || '[]')
  const products = await loadProducts(collectProductIds(rawItems))
  const draft = parseDraftItems(rawItems, products)
  if ('error' in draft) return draft

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gift_selections')
    .insert({
      company_id: companyId,
      name,
      allowed_email_domains: domains,
      opens_at: window.opens,
      closes_at: window.closes,
      created_by: profile.id,
    })
    .select('id')
    .single()
  if (error || !data) {
    if (error && /gift_selections|schema cache/i.test(error.message)) {
      return { error: 'Apply the gift selection migration before creating a campaign.' }
    }
    return { error: error?.message || 'Could not create the gift selection.' }
  }
  const saved = await insertItems(data.id, draft.items, products)
  if ('error' in saved) return saved
  revalidatePath('/crm/gift-selections')
  redirect(`/crm/gift-selections/${data.id}`)
}

export async function updateGiftSelection(formData: FormData) {
  return withIdempotency('crm.updateGiftSelection', formData, () => updateGiftSelectionOnce(formData))
}

async function updateGiftSelectionOnce(formData: FormData) {
  const profile = await requireGiftStaff()
  if (!profile) return { error: STAFF_DENIED }
  const id = String(formData.get('id') || '')
  if (!isUuid(id)) return { error: 'Gift selection not found.' }
  const name = String(formData.get('name') || '').trim()
  if (!name) return { error: 'Name the gift selection.' }
  const domains = parseAllowedEmailDomains(String(formData.get('allowed_email_domains') || ''))
  const domainError = giftDomainListProblem(domains)
  if (domainError) return { error: domainError }
  const window = windowIso(String(formData.get('opens_at') || ''), String(formData.get('closes_at') || ''))
  if ('error' in window) return window

  const supabase = await createClient()
  const { count } = await supabase
    .from('gift_selection_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('selection_id', id)
  const { error } = await supabase
    .from('gift_selections')
    .update({
      name,
      allowed_email_domains: domains,
      opens_at: window.opens,
      closes_at: window.closes,
    })
    .eq('id', id)
  if (error) return { error: error.message }

  if ((count || 0) === 0 && formData.has('items_json')) {
    const rawItems = String(formData.get('items_json') || '[]')
    const products = await loadProducts(collectProductIds(rawItems))
    const draft = parseDraftItems(rawItems, products)
    if ('error' in draft) return draft
    const { data: previousItems } = await supabase.from('gift_selection_items').select('id').eq('selection_id', id)
    const saved = await insertItems(id, draft.items, products)
    if ('error' in saved) return saved
    const previousIds = (previousItems || []).map((row) => row.id)
    if (previousIds.length) {
      const { error: clearError } = await supabase.from('gift_selection_items').delete().in('id', previousIds)
      if (clearError) return { error: clearError.message }
    }
  }

  revalidatePath(`/crm/gift-selections/${id}`)
  revalidatePath('/crm/gift-selections')
  return { success: true }
}

export async function resetGiftSubmission(formData: FormData) {
  return withIdempotency('crm.resetGiftSubmission', formData, async () => {
    const profile = await requireGiftStaff()
    if (!profile) return { error: STAFF_DENIED }
    const id = String(formData.get('id') || '')
    const selectionId = String(formData.get('selection_id') || '')
    if (!isUuid(id)) return { error: 'Submission not found.' }
    const supabase = await createClient()
    const { error } = await supabase.from('gift_selection_submissions').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(`/crm/gift-selections/${selectionId}`)
    return { success: true }
  })
}
