'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { updatePassword } from '@/app/login/actions'
import { AuthShell } from '@/components/auth/auth-shell'
import { PasswordField } from '@/components/auth/password-field'
import { createRecoveryBrowserClient } from '@/lib/supabase/recovery-client'

const INVALID_LINK = 'Password reset link is invalid or has expired.'

function stripRecoveryParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('token_hash')
  url.searchParams.delete('type')
  url.searchParams.delete('error')
  url.hash = ''
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}

export function ResetPasswordForm({
  hasServerSession,
  markedInvalid,
}: {
  hasServerSession: boolean
  markedInvalid: boolean
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(hasServerSession)
  const [hasSession, setHasSession] = useState(hasServerSession)

  useEffect(() => {
    if (hasServerSession) {
      stripRecoveryParams()
      setHasSession(true)
      setReady(true)
      setError(null)
      return
    }

    const supabase = createRecoveryBrowserClient()
    let cancelled = false

    const run = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (cancelled) return
        if (sessionError) {
          setHasSession(false)
          setError(INVALID_LINK)
          setReady(true)
          return
        }
        stripRecoveryParams()
        setHasSession(true)
        setError(null)
        setReady(true)
        return
      }

      if (markedInvalid) {
        setHasSession(false)
        setError(INVALID_LINK)
        setReady(true)
        return
      }

      setHasSession(false)
      setError(INVALID_LINK)
      setReady(true)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [hasServerSession, markedInvalid])

  const passwordError =
    password && password.length < 8
      ? 'Password must be at least 8 characters'
      : password && confirm && password !== confirm
        ? 'Passwords do not match'
        : null
  const canSubmit = hasSession && ready && !loading && password.length >= 8 && password === confirm

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!hasSession) {
      setError(INVALID_LINK)
      return
    }
    if (passwordError) {
      setError(passwordError)
      return
    }
    setLoading(true)
    const formData = new FormData()
    formData.set('password', password)
    formData.set('confirm_password', confirm)
    const result = await updatePassword(formData)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    stripRecoveryParams()
    router.replace('/login?reset=success')
  }

  return (
    <AuthShell title="Reset your password">
      <form onSubmit={onSubmit} className="space-y-5">
        {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{error}</div>}
        {!ready && (
          <div className="flex items-center justify-center gap-2 text-xs text-[#7A7267]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Restoring password recovery session…
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-[#5A5248] mb-1.5 uppercase tracking-wider">New password</label>
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" minLength={8} placeholder="At least 8 characters" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#5A5248] mb-1.5 uppercase tracking-wider">Confirm new password</label>
          <PasswordField name="confirm_password" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={8} placeholder="Re-enter password" />
        </div>
        {passwordError && (
          <p className="text-xs text-red-700">{passwordError}</p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-xs font-semibold text-white bg-[#1A3022] hover:bg-[#274433] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset password'}
        </button>
      </form>
      <p className="text-xs text-center text-[#7A7267] mt-5 space-y-2">
        {!hasSession && ready ? (
          <span className="block">
            <Link href="/forgot-password" className="font-semibold text-[#4A235A] hover:underline">Request a new reset link</Link>
          </span>
        ) : null}
        <span className="block">
          <Link href="/login" className="font-semibold text-[#4A235A] hover:underline">Back to sign in</Link>
        </span>
      </p>
    </AuthShell>
  )
}
