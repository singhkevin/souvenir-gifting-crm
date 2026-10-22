import { isIsoDate } from './schedule'
import type {
  CollectionDef,
  CollectionRule,
  CollectionSort,
  HeroStat,
  OccasionCard,
  PackagingIcon,
  PackagingTile,
  ProductSource,
  RuleCondition,
  Schedule,
  SectionContent,
  SectionType,
  SlotContent,
} from './types'

/**
 * Defensive readers for jsonb and form input. Unknown keys are dropped, strings are
 * trimmed and capped, numbers are clamped, so a bad row can never break the homepage.
 */

type Raw = Record<string, unknown>

const asRecord = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {})
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export function text(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function optionalText(value: unknown, max = 300): string | undefined {
  const result = text(value, max)
  return result ? result : undefined
}

/** Site-relative paths or http(s) links only. */
export function safeHref(value: unknown): string | undefined {
  const href = text(value, 500)
  if (!href) return undefined
  if (href.startsWith('/') && !href.startsWith('//')) return href
  if (/^https?:\/\//i.test(href)) return href
  return undefined
}

function int(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeSchedule(value: unknown): Schedule {
  const raw = asRecord(value)
  const schedule: Schedule = {}
  if (isIsoDate(raw.startsOn)) schedule.startsOn = raw.startsOn
  if (isIsoDate(raw.endsOn)) schedule.endsOn = raw.endsOn
  if (raw.repeatYearly === true) schedule.repeatYearly = true
  return schedule
}

function stringList(value: unknown, max = 40): string[] {
  return asArray(value)
    .map((item) => text(item, 80))
    .filter(Boolean)
    .slice(0, max)
}

function number(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function normalizeCondition(value: unknown): RuleCondition | null {
  const raw = asRecord(value)
  switch (raw.field) {
    case 'category':
    case 'occasion': {
      const list = stringList(raw.in)
      return list.length ? { field: raw.field, in: list } : null
    }
    case 'name':
    case 'description': {
      const keywords = stringList(raw.keywords)
      return keywords.length ? { field: raw.field, keywords } : null
    }
    case 'price': {
      const condition: RuleCondition = { field: 'price' }
      const gt = number(raw.gt)
      const gte = number(raw.gte)
      const lt = number(raw.lt)
      const lte = number(raw.lte)
      if (gt !== undefined) condition.gt = gt
      if (gte !== undefined) condition.gte = gte
      if (lt !== undefined) condition.lt = lt
      if (lte !== undefined) condition.lte = lte
      return Object.keys(condition).length > 1 ? condition : null
    }
    default:
      return null
  }
}

export function normalizeRule(value: unknown): CollectionRule {
  const raw = asRecord(value)
  const rule: CollectionRule = {}
  const all = asArray(raw.all).map(normalizeCondition).filter((item): item is RuleCondition => item !== null)
  const any = asArray(raw.any).map(normalizeCondition).filter((item): item is RuleCondition => item !== null)
  if (all.length) rule.all = all
  if (any.length) rule.any = any
  return rule
}

const SORTS: CollectionSort[] = ['catalogue', 'price_asc', 'price_desc', 'newest']

export function normalizeSort(value: unknown): CollectionSort {
  return SORTS.includes(value as CollectionSort) ? (value as CollectionSort) : 'catalogue'
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type CollectionRow = {
  id: string
  slug: string
  title: string
  kicker: string | null
  description: string | null
  image_url: string | null
  source: string
  rule: unknown
  sort: string
  status: string
  show_in_store: boolean
  show_in_business: boolean
  listed: boolean
  starts_on: string | null
  ends_on: string | null
  repeat_yearly: boolean
  position: number
  collection_products?: { product_id: string; position: number }[] | null
}

export function collectionFromRow(row: CollectionRow): CollectionDef {
  const schedule: Schedule = {}
  if (row.starts_on) schedule.startsOn = String(row.starts_on).slice(0, 10)
  if (row.ends_on) schedule.endsOn = String(row.ends_on).slice(0, 10)
  if (row.repeat_yearly) schedule.repeatYearly = true
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    kicker: row.kicker || '',
    description: row.description || '',
    imageUrl: row.image_url || null,
    source: row.source === 'manual' ? 'manual' : 'rule',
    rule: normalizeRule(row.rule),
    sort: normalizeSort(row.sort),
    status: row.status === 'published' ? 'published' : 'draft',
    showInStore: row.show_in_store,
    showInBusiness: row.show_in_business,
    listed: row.listed,
    schedule,
    position: row.position,
    productIds: [...(row.collection_products || [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.product_id),
  }
}

function normalizeSource(value: unknown): ProductSource {
  const raw = asRecord(value)
  if (raw.kind === 'collection') {
    const slug = text(raw.collectionSlug, 80)
    if (SLUG_PATTERN.test(slug)) return { kind: 'collection', collectionSlug: slug }
  }
  return { kind: 'auto' }
}

export function normalizeCard(value: unknown): OccasionCard | null {
  const raw = asRecord(value)
  const title = text(raw.title, 120)
  const slug = text(raw.collectionSlug, 80)
  if (!title || !SLUG_PATTERN.test(slug)) return null
  return {
    title,
    kicker: text(raw.kicker, 60),
    line: text(raw.line, 200),
    href: safeHref(raw.href) || `/collections/${slug}`,
    collectionSlug: slug,
    size: raw.size === 'small' ? 'small' : 'large',
  }
}

const ICONS: PackagingIcon[] = ['gift', 'pen', 'truck', 'map', 'search']

function base(raw: Raw, fallbackPosition: number) {
  const content: Raw = {
    visible: bool(raw.visible, true),
    position: int(raw.position, fallbackPosition, 0, 10000),
    heading: text(raw.heading, 200),
  }
  const schedule = normalizeSchedule(raw.schedule)
  if (Object.keys(schedule).length) content.schedule = schedule
  const eyebrow = optionalText(raw.eyebrow, 80)
  const subtext = optionalText(raw.subtext, 600)
  const ctaLabel = optionalText(raw.ctaLabel, 60)
  const ctaHref = safeHref(raw.ctaHref)
  if (eyebrow) content.eyebrow = eyebrow
  if (subtext) content.subtext = subtext
  if (ctaLabel) content.ctaLabel = ctaLabel
  if (ctaHref) content.ctaHref = ctaHref
  return content
}

export const SECTION_TYPES: SectionType[] = ['hero', 'occasion_grid', 'product_rail', 'brand_row', 'packaging', 'catalogue_grid']

export function normalizeSectionContent(type: SectionType, value: unknown, fallbackPosition = 0): SectionContent | null {
  const raw = asRecord(value)
  const content = base(raw, fallbackPosition)
  switch (type) {
    case 'hero': {
      const cta2Label = optionalText(raw.cta2Label, 60)
      const cta2Href = safeHref(raw.cta2Href)
      const stats: HeroStat[] = asArray(raw.stats)
        .map((item) => ({ title: text(asRecord(item).title, 80), text: text(asRecord(item).text, 160) }))
        .filter((item) => item.title || item.text)
        .slice(0, 4)
      return {
        ...content,
        type,
        ...(cta2Label ? { cta2Label } : {}),
        ...(cta2Href ? { cta2Href } : {}),
        source: normalizeSource(raw.source),
        itemCount: int(raw.itemCount, 12, 4, 24),
        stats,
      } as SectionContent
    }
    case 'occasion_grid':
      return {
        ...content,
        type,
        cards: asArray(raw.cards).map(normalizeCard).filter((card): card is OccasionCard => card !== null).slice(0, 12),
      } as SectionContent
    case 'product_rail': {
      const columns = int(raw.columns, 5, 4, 6) as 4 | 5 | 6
      return {
        ...content,
        type,
        source: normalizeSource(raw.source),
        itemCount: int(raw.itemCount, columns, 1, 24),
        columns,
        dark: bool(raw.dark, false),
      } as SectionContent
    }
    case 'brand_row':
      return { ...content, type } as SectionContent
    case 'packaging': {
      const tiles: PackagingTile[] = asArray(raw.tiles)
        .map((item) => {
          const tile = asRecord(item)
          return {
            title: text(tile.title, 120),
            description: text(tile.description, 300),
            icon: ICONS.includes(tile.icon as PackagingIcon) ? (tile.icon as PackagingIcon) : 'gift',
          }
        })
        .filter((tile) => tile.title)
        .slice(0, 5)
      const imageUrls = asArray(raw.imageUrls)
        .map((url) => safeHref(url))
        .filter((url): url is string => Boolean(url))
        .slice(0, 2)
      return { ...content, type, imageUrls, tiles } as SectionContent
    }
    case 'catalogue_grid':
      return { ...content, type, itemCount: int(raw.itemCount, 8, 4, 48) } as SectionContent
    default:
      return null
  }
}

export function normalizeSlotContent(value: unknown): SlotContent | null {
  const raw = asRecord(value)
  const label = text(raw.label, 120)
  const schedule = normalizeSchedule(raw.schedule)
  if (!label || (!schedule.startsOn && !schedule.endsOn)) return null
  const slot: SlotContent = {
    label,
    schedule,
    priority: int(raw.priority, 0, -100, 100),
    target: raw.target === 'card' ? 'card' : 'section',
  }
  if (slot.target === 'card') {
    const card = normalizeCard(raw.card)
    if (!card) return null
    slot.card = card
    const position = number(raw.cardPosition)
    slot.cardPosition = position && position >= 1 ? Math.round(position) : null
    return slot
  }
  const overridesRaw = asRecord(raw.overrides)
  const overrides: NonNullable<SlotContent['overrides']> = {}
  for (const key of ['eyebrow', 'heading', 'subtext', 'ctaLabel'] as const) {
    const value = optionalText(overridesRaw[key], key === 'subtext' ? 600 : 200)
    if (value) overrides[key] = value
  }
  const href = safeHref(overridesRaw.ctaHref)
  if (href) overrides.ctaHref = href
  if (overridesRaw.source) {
    const source = normalizeSource(overridesRaw.source)
    if (source.kind === 'collection') overrides.source = source
  }
  slot.overrides = overrides
  return slot
}
