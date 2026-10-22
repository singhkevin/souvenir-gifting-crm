'use client'

import { useState } from 'react'
import { registerBusiness } from '@/app/business/actions'
import { PasswordField } from '@/components/auth/password-field'
import { TurnstileWidget } from '@/components/site/turnstile-widget'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export function RegisterForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const inputClass =
    'mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#FCF9F2] px-3 py-2.5 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none transition-colors'
  const labelClass = 'block font-sans text-xs font-semibold uppercase tracking-wider text-[#4A4640]'

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-6 sm:p-8">
        <ActionForm
          action={registerBusiness}
          className="space-y-5"
          successMessage="Check your email for a confirmation link."
          resetOnSuccess
        >
          <div className="border-b border-[#CCC5BD] pb-4">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#9E4300] block mb-1">
              CORPORATE ACCESS
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1B1A]">Register a business</h1>
            <p className="mt-2 text-sm text-[#4A4640] leading-relaxed">
              India only. Use a work email. GSTIN is optional (must pass format verification). Sales approves the account before corporate pricing opens.
            </p>
          </div>
          <input name="fax" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <label className={labelClass}>
            Your name
            <input name="full_name" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Work email
            <input name="email" type="email" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Password
            <PasswordField
              name="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters"
              className="mt-1 block w-full rounded-none border border-[#CCC5BD] bg-[#FCF9F2] pl-10 pr-10 py-2.5 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none transition-colors"
            />
          </label>
          <label className={labelClass}>
            Confirm password
            <PasswordField
              name="confirm_password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Repeat the password"
              className="mt-1 block w-full rounded-none border border-[#CCC5BD] bg-[#FCF9F2] pl-10 pr-10 py-2.5 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none transition-colors"
            />
          </label>
          <label className={labelClass}>
            Phone
            <input name="phone" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Legal company name
            <input name="legal_name" required className={inputClass} />
          </label>
          <input type="hidden" name="country" value="India" />
          <p className="font-sans text-xs text-[#7C766F]">Country: India</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              State
              <input name="state" className={inputClass} />
            </label>
            <label className={labelClass}>
              City
              <input name="city" required className={inputClass} />
            </label>
          </div>
          <label className={labelClass}>
            Website
            <input name="website" className={inputClass} />
          </label>
          <label className={labelClass}>
            GSTIN (optional)
            <input name="gst_number" className={inputClass} placeholder="15-character GSTIN" />
          </label>
          <TurnstileWidget />
          <SubmitButton
            pendingLabel="Registering…"
            className="w-full bg-[#000000] hover:bg-[#9E4300] px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wider text-[#FCF9F2] transition-colors"
          >
            Create business account
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  )
}
