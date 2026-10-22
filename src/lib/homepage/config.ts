import { DEFAULT_COLLECTIONS, DEFAULT_HOMEPAGE } from './defaults'
import { collectionFromRow, normalizeSectionContent, normalizeSlotContent, SECTION_TYPES, type CollectionRow } from './normalize'
import type { CollectionDef, HomepageConfig, HomepageSection, HomepageSlot, SectionType } from './types'

/** Pure assembly of database rows into config, with the built-in fallback. */

export const HOMEPAGE_PAGE = 'retail_home'

export type SectionRow = {
  id: string
  section_key: string
  section_type: string
  draft: unknown
  published: unknown
}

export type SlotRow = {
  id: string
  section_id: string
  draft: unknown
  published: unknown
  created_at: string
}

export type ConfigSource = 'database' | 'built-in'

/** PostgREST and Postgres errors that mean the homepage tables are not there yet. */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST200') return true
  return /does not exist|could not find the table|schema cache/i.test(error.message || '')
}

export function configFromRows(
  sectionRows: SectionRow[] | null | undefined,
  slotRows: SlotRow[] | null | undefined,
  mode: 'published' | 'draft',
): { config: HomepageConfig; source: ConfigSource } {
  const sections: HomepageSection[] = []
  const keyById = new Map<string, string>()
  for (const [index, row] of (sectionRows || []).entries()) {
    if (!SECTION_TYPES.includes(row.section_type as SectionType)) continue
    const raw = mode === 'draft' ? row.draft ?? row.published : row.published
    if (raw == null) continue
    const content = normalizeSectionContent(row.section_type as SectionType, raw, (index + 1) * 10)
    if (!content) continue
    keyById.set(row.id, row.section_key)
    sections.push({ id: row.id, key: row.section_key, type: row.section_type as SectionType, content })
  }
  if (!sections.length) return { config: DEFAULT_HOMEPAGE, source: 'built-in' }

  const slots: HomepageSlot[] = []
  for (const row of slotRows || []) {
    const sectionKey = keyById.get(row.section_id)
    const raw = mode === 'draft' ? row.draft : row.published
    if (!sectionKey || raw == null) continue
    const content = normalizeSlotContent(raw)
    if (content) slots.push({ id: row.id, sectionKey, content, createdAt: row.created_at })
  }
  return { config: { sections, slots }, source: 'database' }
}

export function collectionsFromRows(rows: CollectionRow[] | null | undefined): { collections: CollectionDef[]; source: ConfigSource } {
  if (!rows || !rows.length) return { collections: DEFAULT_COLLECTIONS, source: 'built-in' }
  return {
    collections: rows.map(collectionFromRow).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title)),
    source: 'database',
  }
}
