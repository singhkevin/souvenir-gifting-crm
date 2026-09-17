'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { Mail, Loader2 } from 'lucide-react'
import { requestPasswordReset } from '@/app/login/actions'
import { AuthShell } from '@/components/auth/auth-shell'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    setLoading(true)
    const formData = new FormData()
    formData.set('email', email.trim())
    const result = await requestPasswordReset(formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setMessage(result.message || 'If an account exists for that email, a password reset link has been sent.')
  }

  return (
    <AuthShell title="Forgot password" subtitle="Enter your login email. We will send a reset link if an account exists.">
      <form onSubmit={onSubmit} className="space-y-5">
        {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{error}</div>}
        {message && <div className="p-3 bg-green-50 text-green-800 text-xs rounded-xl border border-green-200">{message}</div>}
        <div>
          <label className="block text-xs font-semibold text-[#5A5248] mb-1.5 uppercase tracking-wider">Email</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="block w-full pl-10 pr-3 py-2.5 bg-[#FAF7F2] border border-[#E5DFD5] rounded-xl text-xs"
              placeholder="Enter your email"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-xs font-semibold text-[#FFFFFF] bg-[#806A50] hover:bg-[#9C8567] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
        </button>
      </form>
      <p className="text-xs text-center text-[#7A7267] mt-5">
        <Link href="/login" className="font-semibold text-[#624B32] hover:underline">Back to Sign in</Link>
      </p>
    </AuthShell>
  )
}
