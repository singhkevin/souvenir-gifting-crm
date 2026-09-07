import { redirect } from 'next/navigation'
import { createRecoveryServerClient } from '@/lib/supabase/recovery-server'
import { confirmSearchFromParams } from '@/lib/auth/recovery'
import { ResetPasswordForm } from './reset-password-form'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; error?: string }>
}) {
  const params = await searchParams
  if (params.code || params.token_hash) {
    redirect(`/auth/confirm?${confirmSearchFromParams({
      code: params.code,
      token_hash: params.token_hash,
      type: params.type || 'recovery',
    })}`)
  }

  const supabase = await createRecoveryServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <ResetPasswordForm
      hasServerSession={Boolean(user)}
      markedInvalid={params.error === 'invalid' && !user}
    />
  )
}
