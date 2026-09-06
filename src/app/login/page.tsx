import { redirect } from 'next/navigation'
import { isSafeNext } from '@/lib/safe-next'
import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; code?: string; type?: string; token_hash?: string }>
}) {
  const { next = '', reset = '', code = '', type = '', token_hash = '' } = await searchParams
  if (type === 'recovery' || token_hash || code) {
    const dest = new URLSearchParams()
    if (code) dest.set('code', code)
    if (token_hash) dest.set('token_hash', token_hash)
    if (type) dest.set('type', type)
    redirect(`/reset-password?${dest.toString()}`)
  }
  return <LoginForm next={isSafeNext(next) ? next : ''} resetSuccess={reset === 'success'} />
}
