import 'server-only'

import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/** Matches IDEMPOTENCY_FIELD in src/lib/use-action.tsx. */
export const IDEMPOTENCY_FIELD = 'idempotency_key'

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/

export function idempotencyKeyFrom(source: FormData | string | null | undefined): string | null {
  const raw = typeof source === 'string' ? source : source instanceof FormData ? source.get(IDEMPOTENCY_FIELD) : null
  const key = typeof raw === 'string' ? raw.trim() : ''
  return KEY_PATTERN.test(key) ? key : null
}

type Stored = { kind: 'redirect'; url: string } | { kind: 'value'; value: unknown }

function redirectTarget(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return null
  const digest = (error as { digest?: unknown }).digest
  if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT;')) return null
  return digest.split(';').slice(2, -2).join(';') || null
}

async function pickClient(): Promise<SupabaseClient> {
  return createAdminClient() ?? (await createClient())
}

/**
 * Runs `run` at most once per (scope, key).
 *
 * The first call claims the key through `claim_action_key` (migration 20261007), runs, and stores the
 * outcome. A repeat with the same key either returns the stored outcome (or repeats the redirect), or,
 * when the first call is still running, returns an "in progress" error. Failed runs release the key so
 * the user can correct the form and retry with the same key.
 *
 * Without a valid key, or before the migration is applied, it just runs `run`.
 */
export async function withIdempotency<T>(
  scope: string,
  source: FormData | string | null | undefined,
  run: () => Promise<T>,
): Promise<T | (Partial<T> & { error: string })> {
  const key = idempotencyKeyFrom(source)
  if (!key) return run()

  let client: SupabaseClient
  try {
    client = await pickClient()
  } catch {
    return run()
  }

  const claim = await client.rpc('claim_action_key', { p_scope: scope, p_key: key })
  if (claim.error || !claim.data || typeof claim.data !== 'object') {
    if (claim.error) console.warn('claim_action_key unavailable, running without idempotency:', claim.error.message)
    return run()
  }

  const state = (claim.data as { state?: string; result?: Stored | null }).state
  if (state === 'done') {
    const stored = (claim.data as { result?: Stored | null }).result
    if (stored?.kind === 'redirect') redirect(stored.url)
    if (stored?.kind === 'value') return stored.value as T
    return { success: true } as T
  }
  if (state === 'pending') {
    return { error: 'This request is already being processed. Please wait a moment.' } as Partial<T> & { error: string }
  }

  const finish = (result: Stored) =>
    client.rpc('complete_action_key', { p_scope: scope, p_key: key, p_result: result })
  const release = () => client.rpc('release_action_key', { p_scope: scope, p_key: key })

  try {
    const outcome = await run()
    const failed =
      outcome && typeof outcome === 'object' && 'error' in outcome && Boolean((outcome as { error?: unknown }).error)
    if (failed) await release()
    else await finish({ kind: 'value', value: outcome ?? null })
    return outcome
  } catch (caught) {
    const url = redirectTarget(caught)
    // Redirects that carry an error message mean the action failed; only remember clean ones.
    if (url && !/[?&](error|[a-z_]*_error)=/.test(url)) await finish({ kind: 'redirect', url })
    else await release()
    throw caught
  }
}
