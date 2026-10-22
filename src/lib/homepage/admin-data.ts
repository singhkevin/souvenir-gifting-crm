import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { STORE_OCCASIONS } from '@/lib/catalogue/storefront'
import { HOMEPAGE_PAGE, isMissingTable, type SectionRow, type SlotRow } from './config'
import { DEFAULT_COLLECTIONS, DEFAULT_SECTIONS } from './defaults'
import { collectionFromRow, normalizeSectionContent, normalizeSlotContent, SECTION_TYPES, type CollectionRow } from './normalize'
import { COLLECTION_COLUMNS } from './server'
import type { CollectionDef, HomepageSection, SectionType, SlotContent } from './types'

/** Catalogue setup reads, with the signed-in admin's session (RLS: admin only). */

export type AdminSection = HomepageSection & {
  /** Draft differs from what the store shows. */
  changed: boolean
  publishedAt: string | null
}
export type AdminSlot = {
  id: string
  sectionId: string
  draft: SlotContent | null
  published: SlotContent | null
  createdAt: string
}

export type AdminHomepage =
  | { ready: false; reason: string; sections: AdminSection[]; slots: AdminSlot[] }
  | { ready: true; sections: AdminSection[]; slots: AdminSlot[] }

const NOT_SET_UP =
  'The homepage tables are not set up yet. Apply supabase/migrations/20261022_homepage_cms.sql and 20261022_homepage_cms_seed.sql; until then the store shows the built-in homepage below and nothing here can be saved.'

function builtInSections(): AdminSection[] {
  return DEFAULT_SECTIONS.map((section) => ({ ...section, changed: false, publishedAt: null }))
}

export async function loadAdminHomepage(): Promise<AdminHomepage> {
  const supabase = await createClient()
  const sections = await supabase
    .from('homepage_sections')
    .select('id, section_key, section_type, draft, published, published_at')
    .eq('page', HOMEPAGE_PAGE)
  if (sections.error) {
    return { ready: false, reason: isMissingTable(sections.error) ? NOT_SET_UP : sections.error.message, sections: builtInSections(), slots: [] }
  }
  const rows = (sections.data || []) as (SectionRow & { published_at: string | null })[]
  if (!rows.length) {
    return {
      ready: false,
      reason: 'The homepage tables exist but have no sections. Apply supabase/migrations/20261022_homepage_cms_seed.sql.',
      sections: builtInSections(),
      slots: [],
    }
  }
  const list: AdminSection[] = []
  for (const [index, row] of rows.entries()) {
    if (!SECTION_TYPES.includes(row.section_type as SectionType)) continue
    const content = normalizeSectionContent(row.section_type as SectionType, row.draft, (index + 1) * 10)
    if (!content) continue
    list.push({
      id: row.id,
      key: row.section_key,
      type: row.section_type as SectionType,
      content,
      changed: JSON.stringify(normalizeSectionContent(row.section_type as SectionType, row.published)) !== JSON.stringify(content) || row.published == null,
      publishedAt: row.published_at,
    })
  }
  list.sort((a, b) => a.content.position - b.content.position)
  const slotResult = await supabase
    .from('homepage_slots')
    .select('id, section_id, draft, published, created_at')
    .in('section_id', list.map((section) => section.id as string))
    .order('created_at')
  const slots: AdminSlot[] = ((slotResult.data || []) as SlotRow[]).map((row) => ({
    id: row.id,
    sectionId: row.section_id,
    draft: row.draft == null ? null : normalizeSlotContent(row.draft),
    published: row.published == null ? null : normalizeSlotContent(row.published),
    createdAt: row.created_at,
  }))
  return { ready: true, sections: list, slots }
}

export function slotChanged(slot: AdminSlot) {
  return JSON.stringify(slot.draft) !== JSON.stringify(slot.published)
}

export async function loadAdminCollections(): Promise<{ ready: boolean; reason?: string; collections: CollectionDef[] }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('collections').select(COLLECTION_COLUMNS).order('position')
  if (error) return { ready: false, reason: isMissingTable(error) ? NOT_SET_UP : error.message, collections: DEFAULT_COLLECTIONS }
  if (!data?.length) {
    return { ready: true, reason: 'No collections in the table yet. The store uses the built-in collections until 20261022_homepage_cms_seed.sql is applied or one is created.', collections: [] }
  }
  return { ready: true, collections: (data as unknown as CollectionRow[]).map(collectionFromRow) }
}

export async function loadCatalogueFacets() {
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('name').order('name')
  return {
    categories: [...new Set(((categories || []) as { name: string }[]).map((row) => row.name))],
    occasions: STORE_OCCASIONS.map((item) => ({ id: item.id as string, label: item.label as string })),
  }
}
