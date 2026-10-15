'use client'

import { useState } from 'react'
import { registerBusiness } from '@/app/business/actions'
import { PasswordField } from '@/components/auth/password-field'
import { TurnstileWidget } from '@/components/site/turnstile-widget'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { StoreTitle, storeFieldClass } from '@/components/site/store-ui'

export function RegisterForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  return (
    <ActionForm action={registerBusiness} className="mx-auto max-w-xl space-y-4 px-4 py-12" successMessage="Check your email for a confirmation link." resetOnSuccess>
      <StoreTitle
        eyebrow="Business"
        title="Create an account"
        lede="India only. Use a work email and a valid GSTIN. Sales approves the account before prices and quotes open."
      />
      <input name="fax" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="block text-sm">Your name<input name="full_name" required className={storeFieldClass} /></label>
      <label className="block text-sm">Work email<input name="email" type="email" required className={storeFieldClass} /></label>
      <label className="block text-sm">
        Password
        <PasswordField name="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} placeholder="At least 8 characters" />
      </label>
      <label className="block text-sm">
        Confirm password
        <PasswordField name="confirm_password" value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Repeat the password" />
      </label>
      <label className="block text-sm">Phone<input name="phone" required className={storeFieldClass} /></label>
      <label className="block text-sm">Legal name<input name="legal_name" required className={storeFieldClass} /></label>
      <input type="hidden" name="country" value="India" />
      <p className="text-sm text-[#5C6570]">Country. India</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">State<input name="state" className={storeFieldClass} /></label>
        <label className="block text-sm">City<input name="city" required className={storeFieldClass} /></label>
      </div>
      <label className="block text-sm">Website<input name="website" className={storeFieldClass} /></label>
      <label className="block text-sm">GSTIN<input name="gst_number" required className={storeFieldClass} /></label>
      <TurnstileWidget />
      <SubmitButton pendingLabel="Registering…" className="bg-[#22180b] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#382c1e]">
        Create business account
      </SubmitButton>
    </ActionForm>
  )
}
