'use client'

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { createCompany } from '@/app/crm/companies/actions'
import { createContact } from '@/app/crm/contacts/actions'
import { ActionForm } from '@/components/ui/action-form'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { SubmitButton } from '@/components/ui/submit-button'
import { createRequirement } from '../actions'

type CompanyChoice = { id: string; name: string }
type ContactChoice = { id: string; full_name: string | null; company_id: string | null }
type OwnerChoice = { id: string; full_name: string | null }

function byLabel(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

function createdCompany(result: unknown): CompanyChoice | null {
  if (!result || typeof result !== 'object' || !('company' in result)) return null
  const company = (result as { company?: unknown }).company
  if (!company || typeof company !== 'object') return null
  const row = company as { id?: unknown; name?: unknown }
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || !row.id || !row.name) return null
  return { id: row.id, name: row.name }
}

function createdContact(result: unknown): ContactChoice | null {
  if (!result || typeof result !== 'object' || !('contact' in result)) return null
  const contact = (result as { contact?: unknown }).contact
  if (!contact || typeof contact !== 'object') return null
  const row = contact as { id?: unknown; full_name?: unknown; company_id?: unknown }
  if (typeof row.id !== 'string' || !row.id) return null
  if (row.full_name != null && typeof row.full_name !== 'string') return null
  if (row.company_id != null && typeof row.company_id !== 'string') return null
  return {
    id: row.id,
    full_name: typeof row.full_name === 'string' ? row.full_name : null,
    company_id: typeof row.company_id === 'string' ? row.company_id : null,
  }
}

function QuickDialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#1C1B1A]/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md border border-[#CCC5BD] bg-[#FCF9F2] p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-[family-name:var(--font-newsreader)] text-2xl font-normal text-[#1C1B1A]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center border border-[#CCC5BD] bg-[#F6F3EC] text-[#1C1B1A]"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const fieldClass = 'mt-1 min-h-11 w-full border px-3 py-2'
const addButtonClass =
  'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border border-[#CCC5BD] bg-white px-3 text-xs font-semibold text-[#1C1B1A] hover:border-[#9E4300] hover:text-[#9E4300] disabled:cursor-not-allowed disabled:opacity-40'

function CompanyQuickModal({ onClose, onCreated }: { onClose: () => void; onCreated: (company: CompanyChoice) => void }) {
  return (
    <QuickDialog title="Add company" onClose={onClose}>
      <ActionForm
        action={createCompany}
        refresh={false}
        successMessage="Company added"
        className="grid gap-3 text-sm"
        onSuccess={(result) => {
          const company = createdCompany(result)
          if (company) onCreated(company)
        }}
      >
        <input type="hidden" name="inline" value="1" />
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Name</span>
          <input name="name" required autoFocus placeholder="Company name" className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Domain</span>
          <input name="domain" placeholder="acme.com" autoCapitalize="off" autoCorrect="off" spellCheck={false} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">City</span>
          <input name="city" placeholder="City" className={fieldClass} />
        </label>
        <SubmitButton
          className="inline-flex min-h-11 items-center justify-center bg-[#1C1B1A] px-4 text-sm font-semibold text-[#FCF9F2] hover:bg-[#9E4300]"
          pendingLabel="Creating…"
        >
          Create company
        </SubmitButton>
      </ActionForm>
    </QuickDialog>
  )
}

function ContactQuickModal({
  companyId,
  companyName,
  onClose,
  onCreated,
}: {
  companyId: string
  companyName: string
  onClose: () => void
  onCreated: (contact: ContactChoice) => void
}) {
  return (
    <QuickDialog title="Add contact" onClose={onClose}>
      <p className="mb-3 text-xs font-semibold text-gray-700">Company · {companyName}</p>
      <ActionForm
        action={createContact}
        refresh={false}
        successMessage="Contact added"
        className="grid gap-3 text-sm"
        onSuccess={(result) => {
          const contact = createdContact(result)
          if (contact) onCreated(contact)
        }}
      >
        <input type="hidden" name="company_id" value={companyId} />
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Name</span>
          <input name="full_name" required autoFocus placeholder="Full name" className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Designation</span>
          <input name="designation" placeholder="Designation" className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Email</span>
          <input name="email" type="email" placeholder="Email" className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Phone</span>
          <input name="phone" placeholder="Phone" className={fieldClass} />
        </label>
        <SubmitButton
          className="inline-flex min-h-11 items-center justify-center bg-[#1C1B1A] px-4 text-sm font-semibold text-[#FCF9F2] hover:bg-[#9E4300]"
          pendingLabel="Creating…"
        >
          Create contact
        </SubmitButton>
      </ActionForm>
    </QuickDialog>
  )
}

export function RequirementForm({
  companies: initialCompanies,
  contacts: initialContacts,
  owners,
  defaultOwnerId,
  preselectedCompanyId = '',
  canAddCompany,
  canAddContact,
}: {
  companies: CompanyChoice[]
  contacts: ContactChoice[]
  owners: OwnerChoice[] | null
  defaultOwnerId: string
  preselectedCompanyId?: string
  canAddCompany: boolean
  canAddContact: boolean
}) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [contacts, setContacts] = useState(initialContacts)
  const [companyId, setCompanyId] = useState(
    initialCompanies.some((company) => company.id === preselectedCompanyId) ? preselectedCompanyId : '',
  )
  const [contactId, setContactId] = useState('')
  const [companyOpen, setCompanyOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const closeCompany = useCallback(() => setCompanyOpen(false), [])
  const closeContact = useCallback(() => setContactOpen(false), [])

  const selectedCompany = companies.find((company) => company.id === companyId) || null
  const contactOptions = contacts
    .filter((contact) => contact.company_id === companyId)
    .sort((a, b) => byLabel(a.full_name || '', b.full_name || ''))

  function onCompanyChange(next: string) {
    setCompanyId(next)
    setContactId((current) => {
      const contact = contacts.find((row) => row.id === current)
      return contact && contact.company_id === next ? current : ''
    })
  }

  return (
    <>
      <ActionForm action={createRequirement} className="grid gap-4 border border-[var(--color-border)] bg-white p-5 text-sm sm:p-6">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Requirement name</span>
          <input name="name" required placeholder="e.g. Diwali client kits" className={fieldClass} />
        </label>

        <div className="flex items-end gap-2">
          <MobileSheetSelect
            className="min-w-0 flex-1"
            name="company_id"
            label="Company"
            required
            showDesktopLabel
            value={companyId}
            onChange={onCompanyChange}
            emptyLabel="Select company"
            options={[
              { value: '', label: 'Select company' },
              ...companies.map((company) => ({ value: company.id, label: company.name })),
            ]}
          />
          {canAddCompany ? (
            <button type="button" className={addButtonClass} onClick={() => setCompanyOpen(true)}>
              + Add Company
            </button>
          ) : null}
        </div>

        <div className="flex items-end gap-2">
          <MobileSheetSelect
            className="min-w-0 flex-1"
            name="contact_id"
            label="Contact"
            showDesktopLabel
            value={companyId ? contactId : ''}
            onChange={setContactId}
            disabled={!companyId}
            emptyLabel={companyId ? 'Optional contact' : 'Select a company first'}
            options={[
              { value: '', label: companyId ? 'Optional contact' : 'Select a company first' },
              ...contactOptions.map((contact) => ({
                value: contact.id,
                label: contact.full_name || 'Contact',
              })),
            ]}
          />
          {canAddContact ? (
            <button
              type="button"
              className={addButtonClass}
              disabled={!companyId}
              title={companyId ? undefined : 'Select a company first'}
              onClick={() => {
                if (companyId) setContactOpen(true)
              }}
            >
              + Add Contact
            </button>
          ) : null}
        </div>

        {owners ? (
          <MobileSheetSelect
            name="owner_id"
            label="Owner"
            showDesktopLabel
            defaultValue={defaultOwnerId}
            options={owners.map((owner) => ({
              value: owner.id,
              label: owner.full_name || owner.id,
            }))}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Quantity</span>
            <input name="quantity" type="number" min="1" defaultValue={1} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Budget</span>
            <input name="budget" type="number" min="0" step="0.01" placeholder="Optional" className={fieldClass} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SheetDateField name="deadline" label="Deadline" />
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Delivery city</span>
            <input name="delivery_city" placeholder="Optional" className={fieldClass} />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Purpose</span>
          <input name="purpose" placeholder="e.g. Onboarding kits, festival gifts" className={fieldClass} />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Description</span>
          <textarea
            name="description"
            rows={3}
            placeholder="Brief notes for the sales team"
            className="mt-1 w-full border px-3 py-2"
          />
        </label>

        <SubmitButton
          className="inline-flex min-h-11 items-center justify-center bg-[#806A50] px-4 text-sm font-semibold text-[#FFFFFF] hover:bg-[#9C8567]"
          pendingLabel="Creating…"
        >
          Create Requirement
        </SubmitButton>
      </ActionForm>

      {companyOpen ? (
        <CompanyQuickModal
          onClose={closeCompany}
          onCreated={(company) => {
            setCompanies((current) => {
              if (current.some((row) => row.id === company.id)) return current
              return [...current, company].sort((a, b) => byLabel(a.name, b.name))
            })
            setCompanyId(company.id)
            setContactId('')
            setCompanyOpen(false)
          }}
        />
      ) : null}
      {contactOpen && selectedCompany ? (
        <ContactQuickModal
          companyId={selectedCompany.id}
          companyName={selectedCompany.name}
          onClose={closeContact}
          onCreated={(contact) => {
            const row = { ...contact, company_id: contact.company_id || selectedCompany.id }
            setContacts((current) => {
              if (current.some((item) => item.id === row.id)) return current
              return [...current, row]
            })
            setContactId(row.id)
            setContactOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
