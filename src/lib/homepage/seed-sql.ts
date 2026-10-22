import { DEFAULT_COLLECTIONS, DEFAULT_SECTIONS } from './defaults'

/**
 * Builds supabase/migrations/20261022_homepage_cms_seed.sql from the built-in content.
 * Regenerate with: npx tsx scripts/generate-homepage-seed.ts
 * test/homepage-cms.test.ts fails when the file and the defaults drift apart.
 */

function literal(value: string | null | undefined) {
  if (value == null) return 'null'
  return `'${value.replace(/'/g, "''")}'`
}

function json(value: unknown) {
  const text = JSON.stringify(value)
  if (text.includes('$json$')) throw new Error('Seed content cannot contain $json$')
  return `$json$${text}$json$::jsonb`
}

export function homepageSeedSql() {
  const lines: string[] = []
  lines.push('-- GENERATED from src/lib/homepage/defaults.ts by scripts/generate-homepage-seed.ts. Do not edit by hand.')
  lines.push('-- Seed for 20261022_homepage_cms.sql: the coded homepage and collections, so the store looks')
  lines.push('-- the same on day one. Inserts only missing rows (on conflict do nothing), so re-running never')
  lines.push('-- overwrites CRM edits. Apply after 20261022_homepage_cms.sql. Do not apply from the agent.')
  lines.push('')
  lines.push('begin;')
  lines.push('')
  lines.push('insert into public.collections')
  lines.push('  (slug, title, kicker, description, image_url, source, rule, sort, status, show_in_store, show_in_business, listed, starts_on, ends_on, repeat_yearly, position)')
  lines.push('values')
  lines.push(
    DEFAULT_COLLECTIONS.map(
      (collection) =>
        `  (${[
          literal(collection.slug),
          literal(collection.title),
          literal(collection.kicker),
          literal(collection.description),
          literal(collection.imageUrl),
          literal(collection.source),
          json(collection.rule),
          literal(collection.sort),
          literal(collection.status),
          String(collection.showInStore),
          String(collection.showInBusiness),
          String(collection.listed),
          collection.schedule?.startsOn ? `${literal(collection.schedule.startsOn)}::date` : 'null',
          collection.schedule?.endsOn ? `${literal(collection.schedule.endsOn)}::date` : 'null',
          String(Boolean(collection.schedule?.repeatYearly)),
          String(collection.position),
        ].join(', ')})`,
    ).join(',\n'),
  )
  lines.push('on conflict (slug) do nothing;')
  lines.push('')
  lines.push('insert into public.homepage_sections (page, section_key, section_type, draft, published, published_at)')
  lines.push('values')
  lines.push(
    DEFAULT_SECTIONS.map(
      (section) =>
        `  ('retail_home', ${literal(section.key)}, ${literal(section.type)},\n   ${json(section.content)},\n   ${json(section.content)},\n   now())`,
    ).join(',\n'),
  )
  lines.push('on conflict (page, section_key) do nothing;')
  lines.push('')
  lines.push('commit;')
  lines.push('')
  return lines.join('\n')
}
