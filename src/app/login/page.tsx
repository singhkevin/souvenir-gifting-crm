import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { isSafeNext } from '@/lib/safe-next'
import { LoginForm } from './login-form'
import { confirmSearchFromParams, hasRecoveryQuery } from '@/lib/auth/recovery'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { resolveHost } from '@/lib/portal-host'
import { tenantSignupOffer } from '@/lib/portal/signup-server'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string; code?: string; type?: string; token_hash?: string; confirmed?: string }>
}) {
  const { next = '', reset = '', error = '', code = '', type = '', token_hash = '', confirmed = '' } = await searchParams
  const query = new URLSearchParams()
  if (code) query.set('code', code)
  if (token_hash) query.set('token_hash', token_hash)
  if (type) query.set('type', type)
  if (hasRecoveryQuery(query)) {
    redirect(`/auth/confirm?${confirmSearchFromParams({ code, type, token_hash })}`)
  }
  const headerStore = await headers()
  const host = resolveHost(headerStore.get('x-forwarded-host') || headerStore.get('host'))
  const branded = domainSplitEnabled() && (host.kind === 'tenant' || host.kind === 'portal-root')
  const signup = host.kind === 'tenant' ? await tenantSignupOffer() : null
  return (
    <LoginForm
      next={isSafeNext(next) ? next : ''}
      resetSuccess={reset === 'success'}
      portalError={error === 'portal'}
      confirmed={confirmed === '1'}
      branded={branded}
      signupHref={signup?.href || null}
      companyName={signup?.companyName || null}
    />
  )
}
