import 'server-only'
import { getProfile } from '@/lib/auth'
import { indiaDate, isIsoDate } from './schedule'
import { loadCollections, loadHomepageConfig } from './server'
import type { ConfigSource } from './config'

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/** True when the URL asks for an admin preview (?preview=1). Role is checked separately. */
export function wantsPreview(searchParams?: Record<string, string | string[] | undefined>) {
  return first(searchParams?.preview) === '1'
}

/**
 * Published homepage for today's India date, or for admins with ?preview=1 the draft
 * homepage on ?date=YYYY-MM-DD. Anyone else asking for a preview gets the live page.
 */
export async function resolveHomepageView(searchParams?: Record<string, string | string[] | undefined>) {
  let preview = false
  if (wantsPreview(searchParams)) {
    const profile = await getProfile().catch(() => null)
    preview = Boolean(profile?.is_active && profile.role === 'admin')
  }
  const requestedDate = first(searchParams?.date)
  const date = preview && isIsoDate(requestedDate) ? requestedDate : indiaDate()
  const [{ config, source }, { collections, source: collectionSource }] = await Promise.all([
    loadHomepageConfig(preview ? 'draft' : 'published'),
    loadCollections(),
  ])
  const combined: ConfigSource = source === 'database' || collectionSource === 'database' ? 'database' : 'built-in'
  return { config, collections, date, preview, source: combined }
}
