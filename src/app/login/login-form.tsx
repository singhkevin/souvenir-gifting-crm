'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { signIn } from './actions';
import { signOutToBusinessLogin } from '@/app/business/actions';
import { BUSINESS_REGISTER_PATH } from '@/lib/business/portal-paths';
import { Mail, Loader2 } from 'lucide-react';
import { PasswordField } from '@/components/auth/password-field';
import Image from 'next/image';
import { BrandName } from '@/components/brand/brand-name';
import { BrandLogo } from '@/components/brand/brand-logo';
import { assignWithTab } from '@/lib/supabase/client';

function safeHelpHref(value: string | undefined) {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch {
    return null;
  }
  return null;
}

function isNextRedirect(err: unknown) {
  const digest =
    typeof err === 'object' && err && 'digest' in err
      ? String((err as { digest?: unknown }).digest)
      : ''
  return digest.startsWith('NEXT_REDIRECT')
}

export function LoginForm({
  next = '',
  resetSuccess = false,
  portalError = false,
  confirmed = false,
  branded = false,
  audience,
  notice = null,
  showSignOut = false,
  signupHref = null,
  companyName = null,
}: {
  next?: string
  resetSuccess?: boolean
  portalError?: boolean
  confirmed?: boolean
  branded?: boolean
  audience?: 'business'
  notice?: string | null
  showSignOut?: boolean
  signupHref?: string | null
  companyName?: string | null
}) {
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState<{ href: string; label: string } | null>(null);
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
    setHelp(null);
    const formData = new FormData();
    formData.set('email', loginEmail);
    formData.set('password', loginPassword);
    if (next) formData.set('next', next);
    if (audience) formData.set('audience', audience);
    try {
      const res = await signIn(formData);
      if (res?.error) {
        setError(res.error);
        const href = safeHelpHref(res.helpHref);
        setHelp(href && res.helpLabel ? { href, label: res.helpLabel } : null);
        setLoading(false);
        return;
      }
      if (res?.externalPortal && res.redirectTo) {
        window.location.assign(res.redirectTo);
        return;
      }
      if (res?.redirectTo) {
        assignWithTab(res.redirectTo);
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

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-[#F4EFE6] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      {branded ? (
        <div className="mx-auto mb-6 w-full max-w-lg overflow-hidden">
          <Image src="/site/hero-composition.webp" alt="Corporate gifts" width={1200} height={640} priority className="h-40 w-full object-cover sm:h-52" />
        </div>
      ) : null}
      <div className="space-y-3 text-center sm:mx-auto sm:w-full sm:max-w-md">
        <Link href={audience === 'business' ? '/business' : '/home'} className="inline-block">
          <BrandLogo className="mx-auto h-10 w-auto object-contain sm:h-12" />
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A7267]">
          {audience === 'business' ? 'Business portal' : 'Corporate Gifting CRM'}
        </p>
        <p className="text-xs leading-relaxed text-[#7A7267]">
          {audience === 'business'
            ? 'Use your work email. Prices open after approval.'
            : 'Corporate gifting, from enquiry to payment.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 border border-[#E5DFD5] sm:px-10">
          <p className="text-sm text-[#5A5248] mb-6 text-center">
            {audience === 'business' ? 'Business sign in · use your work email' : <>Sign in to <BrandName /></>}
          </p>
          {notice && !error ? (
            <div className="mb-5 border border-[#CCC5BD] bg-[#F6F3EC] p-3 text-xs text-[#9E4300]">
              <p>{notice}</p>
              {showSignOut ? (
                <form action={signOutToBusinessLogin} className="mt-2">
                  <button className="font-semibold underline" type="submit">
                    Sign out
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-5">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {audience ? <input type="hidden" name="audience" value={audience} /> : null}
            {confirmed && !error && (
              <div className="p-3 bg-green-50 text-green-800 text-xs border border-green-200">
                Email confirmed. Sign in to open your business account.
              </div>
            )}
            {resetSuccess && !error && (
              <div className="p-3 bg-green-50 text-green-800 text-xs border border-green-200">
                Password updated successfully. Please sign in with your new password.
              </div>
            )}
            {portalError && !error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs border border-red-200">
                This account cannot be used on this portal.
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs border border-red-200">
                <p>{error}</p>
                {help ? (
                  <a href={help.href} className="mt-2 inline-block font-semibold underline">
                    {help.label}
                  </a>
                ) : null}
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
                  className="block w-full border border-[#E5DFD5] bg-[#FAF7F2] py-3 pl-10 pr-3 text-base text-[#1C1917] placeholder-gray-400 transition-colors focus:border-[#806A50] focus:outline-none focus:ring-1 focus:ring-[#806A50] sm:py-2.5 sm:text-xs"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#5A5248] uppercase tracking-wider">
                  Password
                </label>
                <Link href="/forgot-password" className="text-[11px] font-semibold text-[#624B32] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordField value={password} onChange={setPassword} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 text-xs font-semibold text-[#FFFFFF] bg-[#806A50] hover:bg-[#9C8567] hover:text-[#FFFFFF] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-center text-[#7A7267] mt-5">
            {signupHref ? (
              <>
                New to {companyName || 'this company'}?{' '}
                <Link href={signupHref} className="font-semibold text-[#624B32] hover:underline">
                  Create an account
                </Link>
              </>
            ) : audience === 'business' ? (
              <>
                Need a business account?{' '}
                <Link href={BUSINESS_REGISTER_PATH} className="font-semibold text-[#624B32] hover:underline">
                  Register
                </Link>
              </>
            ) : (
              <>
                Business portal?{' '}
                <Link href="/business/login" className="font-semibold text-[#624B32] hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
          {branded ? (
            <p className="mt-4 text-center text-xs leading-relaxed text-[#7A7267]">
              <a href="https://www.souvenirgifting.com/business" className="font-semibold text-[#624B32] hover:underline">
                Corporate gifting enquiry
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
