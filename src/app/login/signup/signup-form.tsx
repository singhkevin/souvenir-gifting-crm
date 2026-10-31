'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { PasswordField } from '@/components/auth/password-field'
import { registerPortalUser } from './actions'

export function PortalSignupForm({
  companyName,
  domains,
  blocked,
}: {
  companyName: string
  domains: string[]
  blocked: string | null
}) {
  const [error, setError] = useState<string | null>(blocked)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (blocked) return
    setLoading(true)
    setError(null)
    setMessage(null)
    const formData = new FormData(event.currentTarget)
    formData.set('password', password)
    formData.set('confirm_password', confirm)
    const result = await registerPortalUser(formData)
    setLoading(false)
    if (result.error) setError(result.error)
    else setMessage(result.message || 'Check your email to confirm your account.')
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-[#F4EFE6] px-4 py-10 sm:px-6">
      <div className="space-y-3 text-center sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/login" className="inline-block">
          <BrandLogo className="mx-auto h-10 w-auto object-contain sm:h-12" />
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A7267]">Company portal</p>
        <p className="text-xs leading-relaxed text-[#7A7267]">{companyName}</p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="border border-[#E5DFD5] bg-white px-6 py-8 sm:px-10">
          <p className="mb-6 text-center text-sm text-[#5A5248]">Create your portal account</p>
          {domains.length > 0 ? (
            <p className="mb-5 text-xs leading-relaxed text-[#7A7267]">
              Use your {domains.map((domain) => `@${domain}`).join(' or ')} email. Confirm it from the message we send, then sign in.
            </p>
          ) : null}
          {message ? (
            <div className="mb-5 border border-green-200 bg-green-50 p-3 text-xs text-green-800">{message}</div>
          ) : null}
          {error ? (
            <div className="mb-5 border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
          ) : null}
          {blocked ? null : (
            <form onSubmit={submit} className="space-y-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A5248]">
                Name
                <input
                  name="full_name"
                  required
                  autoComplete="name"
                  className="mt-1.5 block w-full border border-[#E5DFD5] bg-[#FAF7F2] px-3 py-2.5 text-base text-[#1C1917] focus:border-[#806A50] focus:outline-none sm:text-xs"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A5248]">
                Work email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1.5 block w-full border border-[#E5DFD5] bg-[#FAF7F2] px-3 py-2.5 text-base text-[#1C1917] focus:border-[#806A50] focus:outline-none sm:text-xs"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A5248]">
                Password
                <div className="mt-1.5">
                  <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
                </div>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A5248]">
                Confirm password
                <div className="mt-1.5">
                  <PasswordField
                    value={confirm}
                    onChange={setConfirm}
                    autoComplete="new-password"
                    name="confirm_password"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center bg-[#806A50] py-3 text-xs font-semibold text-white hover:bg-[#9C8567] disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
              </button>
            </form>
          )}
          <p className="mt-5 text-center text-xs text-[#7A7267]">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-[#624B32] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
