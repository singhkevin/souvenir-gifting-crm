'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from './actions';
import { Mail, Loader2 } from 'lucide-react';
import { PasswordField } from '@/components/auth/password-field';

/** Dedicated demo identities from the original Oaklane seed. Same password for every seeded user. */
const DEMO_PASSWORD = 'Oaklane-Demo-2026!'

const DEMO_ACCOUNTS = [
  { email: 'admin@oaklane.demo', role: 'Admin', action: 'Login as Admin' },
  { email: 'sales@oaklane.demo', role: 'Sales', action: 'Login as Sales' },
  { email: 'ops@oaklane.demo', role: 'Operations', action: 'Login as Operations' },
  { email: 'accounts@oaklane.demo', role: 'Accounts', action: 'Login as Accounts' },
  { email: 'management@oaklane.demo', role: 'Management', action: 'Login as Management' },
  { email: 'priya@wipro.example', role: 'Client', action: 'Login as Client' },
] as const

function isNextRedirect(err: unknown) {
  const digest =
    typeof err === 'object' && err && 'digest' in err
      ? String((err as { digest?: unknown }).digest)
      : ''
  return digest.startsWith('NEXT_REDIRECT')
}

export function LoginForm({ next = '', resetSuccess = false }: { next?: string; resetSuccess?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const authenticate = async (loginEmail: string, loginPassword: string) => {
    if (!loginEmail.trim() || !loginPassword) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.set('email', loginEmail);
    formData.set('password', loginPassword);
    if (next) formData.set('next', next);
    try {
      const res = await signIn(formData);
      if (res?.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      if (res?.redirectTo) {
        router.push(res.redirectTo);
        router.refresh();
        return;
      }
      setLoading(false);
    } catch (err) {
      if (isNextRedirect(err)) throw err;
      console.error(err);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await authenticate(email, password);
  };

  const loginDemo = async (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    await authenticate(accountEmail, DEMO_PASSWORD);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-[#F4EFE6] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="space-y-3 text-center sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/home" className="inline-block">
          <h1 className="font-serif text-3xl tracking-tight text-[#1C1917] sm:text-4xl">Gifting Solutions</h1>
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A7267]">
          Corporate Gifting CRM
        </p>
        <p className="text-xs leading-relaxed text-[#7A7267]">
          Corporate gifting, from enquiry to payment.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl border border-[#E5DFD5] sm:px-10">
          <p className="text-sm text-[#5A5248] mb-6 text-center">Sign in to Gifting Solutions</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {resetSuccess && !error && (
              <div className="p-3 bg-green-50 text-green-800 text-xs rounded-xl border border-green-200">
                Password updated successfully. Please sign in with your new password.
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#5A5248] mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="block w-full rounded-xl border border-[#E5DFD5] bg-[#FAF7F2] py-3 pl-10 pr-3 text-base text-[#1C1917] placeholder-gray-400 transition-colors focus:border-[#1A3022] focus:outline-none focus:ring-1 focus:ring-[#1A3022] sm:py-2.5 sm:text-xs"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#5A5248] uppercase tracking-wider">
                  Password
                </label>
                <Link href="/forgot-password" className="text-[11px] font-semibold text-[#4A235A] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordField value={password} onChange={setPassword} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-xs font-semibold text-white bg-[#1A3022] hover:bg-[#274433] hover:text-white focus:outline-none shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-center text-[#7A7267] mt-5">
            Need an account?{' '}
            <Link href="/signup" className="font-semibold text-[#4A235A] hover:underline">
              Sign up
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-[#EFE9E0]">
            <p className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider">Demo Accounts</p>
            <p className="text-[11px] font-semibold text-[#92400E] mt-1">
              DEMO / TEST ACCOUNT — NOT FOR CLIENT USE
            </p>
            <p className="text-[11px] text-[#7A7267] mt-1 mb-3">
              Seeded test identities for QA. Normal email/password sign-in still works.
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={loading}
                  onClick={() => loginDemo(account.email)}
                  className="flex w-full flex-col gap-3 rounded-xl border border-[#EFE9E0] bg-[#FAF7F2] p-3 text-left transition-all hover:bg-[#EFE9E0] disabled:opacity-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7A7267]">
                      {account.role}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[#1C1917]">{account.email}</span>
                  </span>
                  <span className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-[11px] font-semibold text-white hover:bg-[#274433] sm:w-auto">
                    {account.action}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
