import { cache } from 'react'
import { unstable_cache, updateTag } from 'next/cache'

/**
 * Cross-request cache for public store data.
 * `unstable_cache` is shared across Vercel instances. `use cache` is not, so a
 * busy store would still hit Supabase once per instance.
 */
export const PUBLIC_READ_TAG = 'catalogue'
export const PUBLIC_READ_SECONDS = 300

export function invalidatePublicCatalogue() {
  updateTag(PUBLIC_READ_TAG)
}

export function cachedPublicRead<Args extends unknown[], T>(
  key: string,
  load: (...args: Args) => Promise<T>,
): (...args: Args) => Promise<T> {
  const persisted = unstable_cache(load, [key], {
    revalidate: PUBLIC_READ_SECONDS,
    tags: [PUBLIC_READ_TAG],
  })
  return cache(persisted) as (...args: Args) => Promise<T>
}
