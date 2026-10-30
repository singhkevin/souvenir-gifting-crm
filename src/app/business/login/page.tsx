import { redirect } from 'next/navigation'
import { LoginForm } from '@/app/login/login-form'
import { getBusinessAccess } from '@/lib/business/access'
import {
  BUSINESS_EMAIL_BLOCKED,
  BUSINESS_WRONG_ACCOUNT,
  BUSINESS_WRONG_STAFF,
} from '@/lib/business/price-access'
import { isSafeNext } from '@/lib/safe-next'

export const dynamic = 'force-dynamic'

function noticeFor(state: string, reason: string | null, error: string) {
  if (state === 'wrong_account') {
    return reason === 'staff' ? BUSINESS_WRONG_STAFF : BUSINESS_WRONG_ACCOUNT
  }
  if (state === 'email_not_allowed' || error === 'email') return BUSINESS_EMAIL_BLOCKED
  if (state === 'rejected' || error === 'rejected') return 'This business account was not approved.'
  if (error === 'blocked') return 'This account is inactive.'
  if (error === 'wrong-account') return BUSINESS_WRONG_ACCOUNT
  return null
}

export default async function BusinessLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next = '', error = '' } = await searchParams
  const access = await getBusinessAccess()
  const safeNext = isSafeNext(next) && next.startsWith('/business') && !next.startsWith('/business/login')
    ? next
    : '/business/dashboard'
  if (access.state === 'verified' || access.state === 'pending') {
    redirect(safeNext)
  }
  const notice = noticeFor(access.state, access.reason, error)
  return (
    <LoginForm
      audience="business"
      next={safeNext}
      notice={notice}
      showSignOut={access.state === 'wrong_account'}
    />
  )
}
