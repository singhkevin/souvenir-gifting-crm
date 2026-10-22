import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { collectionsFromRows, configFromRows, HOMEPAGE_PAGE, isMissingTable, type ConfigSource, type SectionRow, type SlotRow } from './config'
import { DEFAULT_COLLECTIONS, DEFAULT_HOMEPAGE } from './defaults'
import type { CollectionRow } from './normalize'
import type { CollectionDef, HomepageConfig } from './types'

/**
 * Reads the editable homepage and collections with the service-role client (the tables
 * have no public policies). Missing tables, empty tables or any read error fall back to
 * the built-in content, so the store keeps rendering exactly as coded.
 */

export const COLLECTION_COLUMNS =
  'id, slug, title, kicker, description, image_url, source, rule, sort, status, show_in_store, show_in_business, listed, starts_on, ends_on, repeat_yearly, position, collection_products(product_id, position)'

export async function loadCollections(): Promise<{ collections: CollectionDef[]; source: ConfigSource }> {
  const admin = createAdminClient()
  if (!admin) return { collections: DEFAULT_COLLECTIONS, source: 'built-in' }
  const { data, error } = await admin.from('collections').select(COLLECTION_COLUMNS).order('position')
  if (error) {
    if (!isMissingTable(error)) console.error('[homepage] collections read failed; using built-in collections:', error.message)
    return { collections: DEFAULT_COLLECTIONS, source: 'built-in' }
  }
  return collectionsFromRows(data as unknown as CollectionRow[])
}

export async function loadHomepageConfig(mode: 'published' | 'draft' = 'published'): Promise<{ config: HomepageConfig; source: ConfigSource }> {
  const admin = createAdminClient()
  if (!admin) return { config: DEFAULT_HOMEPAGE, source: 'built-in' }
  const sections = await admin
    .from('homepage_sections')
    .select('id, section_key, section_type, draft, published')
    .eq('page', HOMEPAGE_PAGE)
    .order('section_key')
  if (sections.error) {
    if (!isMissingTable(sections.error)) console.error('[homepage] sections read failed; using built-in homepage:', sections.error.message)
    return { config: DEFAULT_HOMEPAGE, source: 'built-in' }
  }
  const ids = (sections.data || []).map((row) => row.id)
  let slotRows: SlotRow[] = []
  if (ids.length) {
    const slots = await admin
      .from('homepage_slots')
      .select('id, section_id, draft, published, created_at')
      .in('section_id', ids)
    if (slots.error) console.error('[homepage] slots read failed; showing sections without seasonal slots:', slots.error.message)
    else slotRows = slots.data as SlotRow[]
  }
  return configFromRows(sections.data as SectionRow[], slotRows, mode)
}
