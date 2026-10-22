import { normalizeRule, normalizeSchedule, normalizeSectionContent, normalizeSlotContent, normalizeSort, SLUG_PATTERN, text, safeHref } from './normalize'
import type { CollectionRule, ProductSource, RuleCondition, SectionContent, SectionType, SlotContent } from './types'

/** FormData readers for the Catalogue setup forms. Output always goes through normalize. */

type Form = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] }

const str = (form: Form, name: string) => {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
const checked = (form: Form, name: string) => form.get(name) === 'on' || form.get(name) === 'true'

export function scheduleFromForm(form: Form, prefix = '') {
  return normalizeSchedule({
    startsOn: str(form, `${prefix}starts_on`) || undefined,
    endsOn: str(form, `${prefix}ends_on`) || undefined,
    repeatYearly: checked(form, `${prefix}repeat_yearly`),
  })
}

/** Select value "auto" or "collection:<slug>". */
export function sourceValue(source: ProductSource | undefined) {
  return source?.kind === 'collection' ? `collection:${source.collectionSlug}` : 'auto'
}
function sourceFromValue(value: string): ProductSource {
  if (value.startsWith('collection:')) return { kind: 'collection', collectionSlug: value.slice('collection:'.length) }
  return { kind: 'auto' }
}

/** Repeated rows named `<prefix>_<field>_<i>`, with `_order_` to sort and `_remove_` to drop. */
function rows(form: Form, prefix: string, fields: string[]) {
  const count = Math.min(40, Number(str(form, `${prefix}_count`)) || 0)
  const list: { order: number; index: number; values: Record<string, string> }[] = []
  for (let index = 0; index < count; index += 1) {
    if (checked(form, `${prefix}_remove_${index}`)) continue
    const values = Object.fromEntries(fields.map((field) => [field, str(form, `${prefix}_${field}_${index}`)]))
    if (!Object.values(values).some(Boolean)) continue
    const order = Number(str(form, `${prefix}_order_${index}`))
    list.push({ order: Number.isFinite(order) && str(form, `${prefix}_order_${index}`) ? order : index + 1, index, values })
  }
  return list.sort((a, b) => a.order - b.order || a.index - b.index).map((row) => row.values)
}

function cardFrom(values: Record<string, string>) {
  return {
    title: values.title,
    kicker: values.kicker,
    line: values.line,
    href: values.href || (values.collection ? `/collections/${values.collection}` : ''),
    collectionSlug: values.collection,
    size: values.size === 'small' ? 'small' : 'large',
  }
}

export function sectionContentFromForm(type: SectionType, form: Form, position: number): SectionContent | null {
  const raw: Record<string, unknown> = {
    visible: checked(form, 'visible'),
    position,
    schedule: scheduleFromForm(form),
    eyebrow: str(form, 'eyebrow'),
    heading: str(form, 'heading'),
    subtext: str(form, 'subtext'),
    ctaLabel: str(form, 'cta_label'),
    ctaHref: str(form, 'cta_href'),
  }
  if (type === 'hero') {
    raw.cta2Label = str(form, 'cta2_label')
    raw.cta2Href = str(form, 'cta2_href')
    raw.source = sourceFromValue(str(form, 'source'))
    raw.itemCount = str(form, 'item_count')
    raw.stats = rows(form, 'stat', ['title', 'text'])
  }
  if (type === 'occasion_grid') raw.cards = rows(form, 'card', ['title', 'kicker', 'line', 'href', 'collection', 'size']).map(cardFrom)
  if (type === 'product_rail') {
    raw.source = sourceFromValue(str(form, 'source'))
    raw.itemCount = str(form, 'item_count')
    raw.columns = str(form, 'columns')
    raw.dark = checked(form, 'dark')
  }
  if (type === 'packaging') {
    raw.imageUrls = [str(form, 'image_url_0'), str(form, 'image_url_1')].filter(Boolean)
    raw.tiles = rows(form, 'tile', ['title', 'description', 'icon'])
  }
  if (type === 'catalogue_grid') raw.itemCount = str(form, 'item_count')
  return normalizeSectionContent(type, raw, position)
}

export function slotContentFromForm(form: Form): SlotContent | null {
  const target = str(form, 'target') === 'card' ? 'card' : 'section'
  const raw: Record<string, unknown> = {
    label: str(form, 'label'),
    schedule: scheduleFromForm(form),
    priority: str(form, 'priority') || 0,
    target,
  }
  if (target === 'card') {
    raw.card = cardFrom({
      title: str(form, 'card_title'),
      kicker: str(form, 'card_kicker'),
      line: str(form, 'card_line'),
      href: str(form, 'card_href'),
      collection: str(form, 'card_collection'),
      size: str(form, 'card_size'),
    })
    raw.cardPosition = str(form, 'card_position') || null
  } else {
    const source = str(form, 'o_source')
    raw.overrides = {
      eyebrow: str(form, 'o_eyebrow'),
      heading: str(form, 'o_heading'),
      subtext: str(form, 'o_subtext'),
      ctaLabel: str(form, 'o_cta_label'),
      ctaHref: str(form, 'o_cta_href'),
      ...(source && source !== 'none' ? { source: sourceFromValue(source) } : {}),
    }
  }
  return normalizeSlotContent(raw)
}

/** The rule editor shows one condition of each kind, combined with any or all. */
export type RuleForm = {
  mode: 'any' | 'all'
  categories: string[]
  occasions: string[]
  nameKeywords: string
  descriptionKeywords: string
  priceGt: string
  priceGte: string
  priceLt: string
  priceLte: string
  /** The stored rule mixes any and all, which the editor cannot show exactly. */
  mixed: boolean
}

export function ruleToForm(rule: CollectionRule): RuleForm {
  const mixed = Boolean(rule.all?.length && rule.any?.length)
  const mode: 'any' | 'all' = rule.all?.length && !rule.any?.length ? 'all' : 'any'
  const conditions = [...(rule.any || []), ...(rule.all || [])]
  const form: RuleForm = { mode, categories: [], occasions: [], nameKeywords: '', descriptionKeywords: '', priceGt: '', priceGte: '', priceLt: '', priceLte: '', mixed }
  for (const condition of conditions) {
    if (condition.field === 'category') form.categories.push(...condition.in)
    if (condition.field === 'occasion') form.occasions.push(...condition.in)
    if (condition.field === 'name') form.nameKeywords = [form.nameKeywords, ...condition.keywords].filter(Boolean).join(', ')
    if (condition.field === 'description') form.descriptionKeywords = [form.descriptionKeywords, ...condition.keywords].filter(Boolean).join(', ')
    if (condition.field === 'price') {
      if (condition.gt != null) form.priceGt = String(condition.gt)
      if (condition.gte != null) form.priceGte = String(condition.gte)
      if (condition.lt != null) form.priceLt = String(condition.lt)
      if (condition.lte != null) form.priceLte = String(condition.lte)
    }
  }
  return form
}

const keywords = (value: string) =>
  value
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean)

export function ruleFromForm(form: Form): CollectionRule {
  const conditions: RuleCondition[] = []
  const categories = form.getAll('rule_category').map(String).filter(Boolean)
  const occasions = form.getAll('rule_occasion').map(String).filter(Boolean)
  if (categories.length) conditions.push({ field: 'category', in: categories })
  if (occasions.length) conditions.push({ field: 'occasion', in: occasions })
  const price: Record<string, unknown> = { field: 'price' }
  for (const [key, name] of [['gt', 'price_gt'], ['gte', 'price_gte'], ['lt', 'price_lt'], ['lte', 'price_lte']] as const) {
    if (str(form, name) !== '') price[key] = str(form, name)
  }
  if (Object.keys(price).length > 1) conditions.push(price as RuleCondition)
  const name = keywords(str(form, 'rule_name_keywords'))
  const description = keywords(str(form, 'rule_description_keywords'))
  if (name.length) conditions.push({ field: 'name', keywords: name })
  if (description.length) conditions.push({ field: 'description', keywords: description })
  const mode = str(form, 'rule_mode') === 'all' ? 'all' : 'any'
  return normalizeRule({ [mode]: conditions })
}

export type CollectionFields = {
  slug: string
  title: string
  kicker: string
  description: string
  image_url: string | null
  source: 'rule' | 'manual'
  rule: CollectionRule
  sort: ReturnType<typeof normalizeSort>
  status: 'draft' | 'published'
  show_in_store: boolean
  show_in_business: boolean
  listed: boolean
  starts_on: string | null
  ends_on: string | null
  repeat_yearly: boolean
  position: number
}

export function collectionFieldsFromForm(form: Form): { fields?: CollectionFields; error?: string } {
  const slug = str(form, 'slug').toLowerCase()
  const title = text(str(form, 'title'), 120)
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) return { error: 'Slug: lowercase letters, numbers and single hyphens, for example diwali-2026.' }
  if (!title) return { error: 'Title is required.' }
  const schedule = scheduleFromForm(form)
  if (schedule.startsOn && schedule.endsOn && !schedule.repeatYearly && schedule.startsOn > schedule.endsOn) {
    return { error: 'The end date is before the start date.' }
  }
  const position = Number(str(form, 'position'))
  return {
    fields: {
      slug,
      title,
      kicker: text(str(form, 'kicker'), 60),
      description: text(str(form, 'description'), 400),
      image_url: safeHref(str(form, 'image_url')) || null,
      source: str(form, 'source') === 'manual' ? 'manual' : 'rule',
      rule: ruleFromForm(form),
      sort: normalizeSort(str(form, 'sort')),
      status: str(form, 'status') === 'published' ? 'published' : 'draft',
      show_in_store: checked(form, 'show_in_store'),
      show_in_business: checked(form, 'show_in_business'),
      listed: checked(form, 'listed'),
      starts_on: schedule.startsOn || null,
      ends_on: schedule.endsOn || null,
      repeat_yearly: Boolean(schedule.repeatYearly),
      position: Number.isFinite(position) ? Math.round(position) : 0,
    },
  }
}

/** Copy still holding a placeholder such as "[X]-hour dispatch" needs the client's input. */
export function needsClientInput(value: string | undefined | null) {
  return Boolean(value && /\[[^\]]*\]/.test(value))
}
