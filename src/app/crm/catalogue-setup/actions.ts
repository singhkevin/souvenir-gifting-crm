'use server'

import { revalidatePath } from 'next/cache'
import { invalidatePublicCatalogue } from '@/lib/catalogue/public-read'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'
import { HOMEPAGE_PAGE, isMissingTable } from '@/lib/homepage/config'
import { collectionFieldsFromForm, sectionContentFromForm, slotContentFromForm } from '@/lib/homepage/form'
import { normalizeSectionContent, SECTION_TYPES } from '@/lib/homepage/normalize'
import type { SectionType } from '@/lib/homepage/types'

type Result = { error?: string; ok?: boolean }

const SETUP_HINT = 'The homepage tables are not set up yet (apply 20261022_homepage_cms.sql and its seed).'

async function adminSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' as const }
  const { data: me } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin' || !me.is_active) return { error: 'Admins only.' as const }
  return { supabase, userId: user.id }
}

function failure(error: { code?: string; message?: string } | null, fallback = 'Could not save.'): Result {
  if (!error) return { error: fallback }
  return { error: isMissingTable(error) ? SETUP_HINT : error.message || fallback }
}

function refreshStore() {
  invalidatePublicCatalogue()
  revalidatePath('/crm/catalogue-setup', 'layout')
  revalidatePath('/')
  revalidatePath('/home')
  revalidatePath('/collections', 'layout')
}

const field = (form: FormData, name: string) => String(form.get(name) || '').trim()

// ---------------------------------------------------------------------------
// Homepage sections

async function draftSections(session: Exclude<Awaited<ReturnType<typeof adminSession>>, { error: string }>) {
  const { data, error } = await session.supabase
    .from('homepage_sections')
    .select('id, section_key, section_type, draft')
    .eq('page', HOMEPAGE_PAGE)
  if (error) return { error }
  const rows = (data || [])
    .filter((row) => SECTION_TYPES.includes(row.section_type as SectionType))
    .map((row, index) => ({
      ...row,
      content: normalizeSectionContent(row.section_type as SectionType, row.draft, (index + 1) * 10)!,
    }))
    .filter((row) => row.content)
    .sort((a, b) => a.content.position - b.content.position)
  return { rows }
}

export async function moveHomepageSection(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const id = field(form, 'id')
  const direction = field(form, 'direction') === 'up' ? -1 : 1
  const loaded = await draftSections(session)
  if ('error' in loaded) return failure(loaded.error ?? null)
  const rows = loaded.rows
  const index = rows.findIndex((row) => row.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= rows.length) return { ok: true }
  ;[rows[index], rows[target]] = [rows[target], rows[index]]
  for (const [order, row] of rows.entries()) {
    const position = (order + 1) * 10
    if (row.content.position === position) continue
    const { error } = await session.supabase
      .from('homepage_sections')
      .update({ draft: { ...row.content, position }, updated_by: session.userId })
      .eq('id', row.id)
    if (error) return failure(error)
  }
  refreshStore()
  return { ok: true }
}

export async function toggleHomepageSection(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const loaded = await draftSections(session)
  if ('error' in loaded) return failure(loaded.error ?? null)
  const row = loaded.rows.find((item) => item.id === field(form, 'id'))
  if (!row) return { error: 'Section not found.' }
  const { error } = await session.supabase
    .from('homepage_sections')
    .update({ draft: { ...row.content, visible: !row.content.visible }, updated_by: session.userId })
    .eq('id', row.id)
  if (error) return failure(error)
  refreshStore()
  return { ok: true }
}

export async function saveHomepageSection(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const loaded = await draftSections(session)
  if ('error' in loaded) return failure(loaded.error ?? null)
  const row = loaded.rows.find((item) => item.id === field(form, 'id'))
  if (!row) return { error: 'Section not found.' }
  const content = sectionContentFromForm(row.section_type as SectionType, form, row.content.position)
  if (!content) return { error: 'Could not read the form.' }
  if (!content.heading && row.section_type !== 'brand_row') return { error: 'Heading is required.' }
  const { error } = await session.supabase
    .from('homepage_sections')
    .update({ draft: content, updated_by: session.userId })
    .eq('id', row.id)
  if (error) return failure(error)
  refreshStore()
  return { ok: true }
}

export async function publishHomepage(): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const { error } = await session.supabase.rpc('publish_homepage', { p_page: HOMEPAGE_PAGE })
  if (error) return failure(error, 'Could not publish.')
  refreshStore()
  return { ok: true }
}

export async function discardHomepageDraft(): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const { data: sections, error } = await session.supabase
    .from('homepage_sections')
    .select('id, draft, published')
    .eq('page', HOMEPAGE_PAGE)
  if (error) return failure(error)
  for (const row of sections || []) {
    if (row.published == null || JSON.stringify(row.draft) === JSON.stringify(row.published)) continue
    const update = await session.supabase.from('homepage_sections').update({ draft: row.published, updated_by: session.userId }).eq('id', row.id)
    if (update.error) return failure(update.error)
  }
  const ids = (sections || []).map((row) => row.id)
  if (ids.length) {
    const removeNew = await session.supabase.from('homepage_slots').delete().in('section_id', ids).is('published', null)
    if (removeNew.error) return failure(removeNew.error)
    const { data: slots } = await session.supabase.from('homepage_slots').select('id, draft, published').in('section_id', ids)
    for (const slot of slots || []) {
      if (JSON.stringify(slot.draft) === JSON.stringify(slot.published)) continue
      const update = await session.supabase.from('homepage_slots').update({ draft: slot.published, updated_by: session.userId }).eq('id', slot.id)
      if (update.error) return failure(update.error)
    }
  }
  refreshStore()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Seasonal slots

export async function saveHomepageSlot(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const sectionId = field(form, 'section_id')
  const slotId = field(form, 'slot_id')
  if (!isUuid(sectionId)) return { error: 'Section not found.' }
  const content = slotContentFromForm(form)
  if (!content) {
    return { error: 'A slot needs a label, at least a start or end date, and for a card slot a title and a collection.' }
  }
  const { startsOn, endsOn, repeatYearly } = content.schedule
  if (startsOn && endsOn && !repeatYearly && startsOn > endsOn) return { error: 'The end date is before the start date.' }
  const { error } = slotId
    ? await session.supabase.from('homepage_slots').update({ draft: content, updated_by: session.userId }).eq('id', slotId).eq('section_id', sectionId)
    : await session.supabase.from('homepage_slots').insert({ section_id: sectionId, draft: content, updated_by: session.userId })
  if (error) return failure(error)
  refreshStore()
  return { ok: true }
}

export async function removeHomepageSlot(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const slotId = field(form, 'slot_id')
  const { data: slot, error } = await session.supabase.from('homepage_slots').select('id, published').eq('id', slotId).maybeSingle()
  if (error) return failure(error)
  if (!slot) return { ok: true }
  // A published slot stays live until the next publish; an unpublished one goes now.
  const result = slot.published == null
    ? await session.supabase.from('homepage_slots').delete().eq('id', slotId)
    : await session.supabase.from('homepage_slots').update({ draft: null, updated_by: session.userId }).eq('id', slotId)
  if (result.error) return failure(result.error)
  refreshStore()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Collections (changes are live as soon as they are saved; status controls visibility)

export async function saveCollection(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const id = field(form, 'id')
  const parsed = collectionFieldsFromForm(form)
  if (!parsed.fields) return { error: parsed.error }
  const body = { ...parsed.fields, updated_by: session.userId }
  if (id) {
    const { error } = await session.supabase.from('collections').update(body).eq('id', id)
    if (error) return failure(error.code === '23505' ? { message: 'Another collection already uses that slug.' } : error)
    refreshStore()
    return { ok: true }
  }
  const { data, error } = await session.supabase.from('collections').insert(body).select('id').single()
  if (error) return failure(error.code === '23505' ? { message: 'Another collection already uses that slug.' } : error)
  refreshStore()
  redirect(`/crm/catalogue-setup/collections/${data.id}`)
}

export async function deleteCollection(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const id = field(form, 'id')
  const { data: collection } = await session.supabase.from('collections').select('slug').eq('id', id).maybeSingle()
  if (!collection) return { error: 'Collection not found.' }
  const { data: sections } = await session.supabase.from('homepage_sections').select('section_key, draft, published')
  const { data: slots } = await session.supabase.from('homepage_slots').select('draft, published')
  const needle = `"${collection.slug}"`
  const usedIn = (sections || [])
    .filter((row) => JSON.stringify([row.draft, row.published]).includes(needle))
    .map((row) => row.section_key)
  const usedBySlot = (slots || []).some((row) => JSON.stringify([row.draft, row.published]).includes(needle))
  if (usedIn.length || usedBySlot) {
    return { error: `The homepage still uses this collection (${[...usedIn, ...(usedBySlot ? ['a seasonal slot'] : [])].join(', ')}). Point those at another collection and publish, or set this one to Draft instead.` }
  }
  const { error } = await session.supabase.from('collections').delete().eq('id', id)
  if (error) return failure(error)
  refreshStore()
  redirect('/crm/catalogue-setup/collections')
}

async function productRows(session: Exclude<Awaited<ReturnType<typeof adminSession>>, { error: string }>, collectionId: string) {
  const { data, error } = await session.supabase
    .from('collection_products')
    .select('product_id, position')
    .eq('collection_id', collectionId)
    .order('position')
  return { rows: (data || []) as { product_id: string; position: number }[], error }
}

async function writeOrder(session: Exclude<Awaited<ReturnType<typeof adminSession>>, { error: string }>, collectionId: string, productIds: string[]) {
  for (const [index, productId] of productIds.entries()) {
    const { error } = await session.supabase
      .from('collection_products')
      .update({ position: (index + 1) * 10 })
      .eq('collection_id', collectionId)
      .eq('product_id', productId)
    if (error) return error
  }
  return null
}

export async function addCollectionProduct(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const collectionId = field(form, 'collection_id')
  const productId = field(form, 'product_id')
  if (!isUuid(collectionId) || !isUuid(productId)) return { error: 'Pick a product.' }
  const { rows, error } = await productRows(session, collectionId)
  if (error) return failure(error)
  if (rows.some((row) => row.product_id === productId)) return { ok: true }
  const position = (rows.length ? Math.max(...rows.map((row) => row.position)) : 0) + 10
  const insert = await session.supabase.from('collection_products').insert({ collection_id: collectionId, product_id: productId, position })
  if (insert.error) return failure(insert.error)
  refreshStore()
  return { ok: true }
}

export async function moveCollectionProduct(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const collectionId = field(form, 'collection_id')
  const productId = field(form, 'product_id')
  const direction = field(form, 'direction') === 'up' ? -1 : 1
  const { rows, error } = await productRows(session, collectionId)
  if (error) return failure(error)
  const order = rows.map((row) => row.product_id)
  const index = order.indexOf(productId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= order.length) return { ok: true }
  ;[order[index], order[target]] = [order[target], order[index]]
  const writeError = await writeOrder(session, collectionId, order)
  if (writeError) return failure(writeError)
  refreshStore()
  return { ok: true }
}

export async function removeCollectionProduct(form: FormData): Promise<Result> {
  const session = await adminSession()
  if ('error' in session) return { error: session.error }
  const { error } = await session.supabase
    .from('collection_products')
    .delete()
    .eq('collection_id', field(form, 'collection_id'))
    .eq('product_id', field(form, 'product_id'))
  if (error) return failure(error)
  refreshStore()
  return { ok: true }
}
