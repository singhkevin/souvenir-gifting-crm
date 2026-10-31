'use client'

import { sendPortalInvitation } from './actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { IDEMPOTENCY_FIELD, useAction, useIdempotencyKey } from '@/lib/use-action'

const fieldClass =
  'w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0'

export function PortalInviteForm({ companyId, allowException = false }: { companyId: string; allowException?: boolean }) {
  return (
    <ActionForm
      action={sendPortalInvitation}
      successMessage="Portal invitation sent"
      resetOnSuccess
      className="grid gap-3 md:grid-cols-2"
    >
      <input type="hidden" name="company_id" value={companyId} />
      <label className="block space-y-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Name</span>
        <input name="full_name" required placeholder="Full name" className={fieldClass} />
      </label>
      <label className="block space-y-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Work email</span>
        <input name="email" type="email" required placeholder="name@company.com" className={`${fieldClass} font-mono`} />
      </label>
      <MobileSheetSelect
        name="role"
        label="Portal role"
        showDesktopLabel
        defaultValue="client_user"
        options={[
          { value: 'client_user', label: 'Client user' },
          { value: 'client_admin', label: 'Client admin' },
        ]}
      />
      {allowException ? (
        <label className="flex items-start gap-2 text-xs text-[#4A4640] md:col-span-2">
          <input type="checkbox" name="domain_exception" value="1" className="mt-0.5" />
          <span>Allow this email even though the domain is not on the company list. This is an explicit exception.</span>
        </label>
      ) : null}
      <div className="flex items-end">
        <SubmitButton
          pendingLabel="Sending…"
          className="w-full bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300]"
        >
          Send portal invitation
        </SubmitButton>
      </div>
      <p className="md:col-span-2 text-[11px] text-[#7C766F]">
        Sends a set-password link. The password is not stored in the CRM. An existing portal login for this company gets a new link.
      </p>
    </ActionForm>
  )
}

export function PortalInviteButton({
  companyId,
  email,
  fullName,
  role = 'client_user',
  label = 'Send portal invitation',
}: {
  companyId: string
  email: string
  fullName?: string | null
  role?: string
  label?: string
}) {
  const { pending, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const ready = Boolean(email.trim())

  return (
    <button
      type="button"
      disabled={pending || !ready}
      onClick={() => {
        const formData = new FormData()
        formData.set('company_id', companyId)
        formData.set('email', email)
        formData.set('full_name', fullName || '')
        formData.set('role', role)
        formData.set(IDEMPOTENCY_FIELD, key)
        run(() => sendPortalInvitation(formData), {
          successMessage: 'Portal invitation sent',
          onSuccess: () => rotate(),
        })
      }}
      className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9E4300] hover:underline disabled:cursor-not-allowed disabled:text-[#7C766F] disabled:no-underline"
    >
      {pending ? 'Sending…' : label}
    </button>
  )
}
