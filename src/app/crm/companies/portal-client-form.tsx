'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createPortalClient } from './actions'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

function CredentialsOnce({
  email,
  password,
  loginUrl,
  onDone,
}: {
  email: string
  password: string
  loginUrl?: string | null
  onDone: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="md:col-span-2 p-4 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] space-y-3">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A]">Client login created</p>
      <p className="text-[11px] text-[#7C766F]">Share these credentials now. They are not stored in the CRM and cannot be recovered later.</p>
      {loginUrl ? (
        <p className="text-xs">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Portal sign in</span>
          <span className="font-mono break-all text-[#9E4300]">{loginUrl}</span>
        </p>
      ) : null}
      <p className="text-xs">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Client ID / Login email</span>
        <span className="font-mono text-[#1C1B1A]">{email}</span>
      </p>
      <p className="text-xs">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Temporary password — share securely</span>
        <span className="font-mono text-[#1C1B1A]">{revealed ? password : '••••••••'}</span>
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] border border-[#1C1B1A] bg-transparent text-[#1C1B1A] hover:bg-[#FCF9F2] rounded-none transition-colors"
        >
          {revealed ? 'Hide' : 'Reveal once'}
        </button>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(loginUrl ? `${loginUrl}\n${email}\n${password}` : `${email}\n${password}`)
            toast.success('Copied')
          }}
          className="px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] border border-[#1C1B1A] bg-transparent text-[#1C1B1A] hover:bg-[#FCF9F2] rounded-none transition-colors"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#FCF9F2] bg-[#1C1B1A] hover:bg-[#9E4300] rounded-none transition-colors shadow-none"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export function PortalClientForm({ companyId }: { companyId: string }) {
  const [formKey, setFormKey] = useState(0)
  const [password, setPassword] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string; loginUrl?: string | null } | null>(null)

  // ActionForm adds `idempotency_key` to the FormData; the server reads it.
  const create = async (formData: FormData) => {
    const result = await createPortalClient(formData)
    if (result?.error) return { error: result.error }
    if (result?.success && result.email && result.temporaryPassword) {
      return { email: result.email, temporaryPassword: result.temporaryPassword, portalLoginUrl: result.portalLoginUrl }
    }
    return { error: 'Client login was not created.' }
  }

  return (
    <ActionForm
      key={formKey}
      action={create}
      successMessage="Client login created"
      onSuccess={(result) => {
        const r = result as { email?: string; temporaryPassword?: string; portalLoginUrl?: string | null } | undefined
        if (r?.email && r.temporaryPassword) setCreated({ email: r.email, password: r.temporaryPassword, loginUrl: r.portalLoginUrl })
        setPassword('')
        setFormKey((key) => key + 1)
      }}
      className="grid md:grid-cols-2 gap-4 text-xs"
    >
      <input type="hidden" name="company_id" value={companyId} />
      <label className="block space-y-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Client Name</span>
        <input
          name="full_name"
          required
          placeholder="Client name"
          className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
        />
      </label>
      <label className="block space-y-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Client ID / Login Email</span>
        <input
          name="email"
          type="email"
          required
          placeholder="Client ID / Login email"
          className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 font-mono"
        />
      </label>
      <MobileSheetSelect
        name="role"
        label="Role"
        showDesktopLabel
        defaultValue="client_user"
        options={[
          { value: 'client_user', label: 'Client user' },
          { value: 'client_admin', label: 'Client admin' },
        ]}
      />
      <label className="block space-y-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Password</span>
        <div className="flex gap-2">
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Temporary password (min 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 font-mono flex-1"
          />
          <SubmitButton
            name="generate_password"
            value="1"
            pendingLabel="Generating…"
            className="px-3.5 py-2 border border-[#1C1B1A] bg-transparent text-[#1C1B1A] hover:bg-[#F6F3EC] rounded-none text-xs font-bold uppercase tracking-[0.08em] whitespace-nowrap transition-colors shadow-none"
          >
            Generate password
          </SubmitButton>
        </div>
      </label>
      <p className="md:col-span-2 text-[11px] text-[#7C766F]">
        The password is sent to Supabase Auth only. It is never stored in application tables.
      </p>
      {created && (
        <CredentialsOnce
          email={created.email}
          password={created.password}
          loginUrl={created.loginUrl}
          onDone={() => setCreated(null)}
        />
      )}
      <SubmitButton
        pendingLabel="Creating login…"
        className="md:col-span-2 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] bg-[#1C1B1A] hover:bg-[#9E4300] rounded-none transition-colors shadow-none"
      >
        Create client login
      </SubmitButton>
    </ActionForm>
  )
}
