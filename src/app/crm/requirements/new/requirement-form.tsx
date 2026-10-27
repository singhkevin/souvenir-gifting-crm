'use client'

import { useMemo, useState } from 'react'
import { createRequirement } from '../actions'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { canEditCompanies, canEditContacts } from '@/lib/roles'
import type { Role } from '@/lib/types'
import {
  QuickCompanyModal,
  QuickContactModal,
  type QuickCompany,
  type QuickContact,
} from '@/components/companies/quick-create-modal'

type CompanyOption = { id: string; name: string }
type ContactOption = { id: string; full_name: string | null; company_id: string | null }
type OwnerOption = { id: string; full_name: string | null }

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of base) map.set(row.id, row)
  for (const row of extra) map.set(row.id, row)
  return [...map.values()]
}

const addButtonClass =
  'inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap border border-[#806A50] px-3 text-xs font-semibold text-[#806A50] hover:bg-[#F6F4F1] disabled:cursor-not-allowed disabled:opacity-50'

export function NewRequirementForm({
  companies,
  contacts,
  owners,
  role,
  currentUserId,
  preselectedCompanyId = '',
}: {
  companies: CompanyOption[]
  contacts: ContactOption[]
  owners: OwnerOption[]
  role: Role
  currentUserId: string
  preselectedCompanyId?: string
}) {
  const [companyId, setCompanyId] = useState(preselectedCompanyId)
  const [contactId, setContactId] = useState('')
  const [extraCompanies, setExtraCompanies] = useState<CompanyOption[]>([])
  const [extraContacts, setExtraContacts] = useState<ContactOption[]>([])
  const [companyOpen, setCompanyOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

  const companyOptions = useMemo(
    () => mergeById(companies, extraCompanies).sort((a, b) => a.name.localeCompare(b.name, 'en')),
    [companies, extraCompanies],
  )
  const contactOptions = useMemo(() => mergeById(contacts, extraContacts), [contacts, extraContacts])
  const visibleContacts = contactOptions
    .filter((contact) => companyId && contact.company_id === companyId)
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'en'))
  const selectedCompany = companyOptions.find((company) => company.id === companyId) || null
  const showAddCompany = canEditCompanies(role)
  const showAddContact = canEditContacts(role)

  function selectCompany(next: string) {
    setCompanyId(next)
    setContactId((current) => {
      const contact = contactOptions.find((row) => row.id === current)
      if (!contact || contact.company_id !== next) return ''
      return current
    })
  }

  function onCompanyCreated(company: QuickCompany) {
    setExtraCompanies((list) => mergeById(list, [company]))
    setCompanyId(company.id)
    setContactId('')
  }

  function onContactCreated(contact: QuickContact) {
    setExtraContacts((list) => mergeById(list, [contact]))
    setContactId(contact.id)
  }

  return (
    <>
      <ActionForm
        action={createRequirement}
        className="grid gap-4 border border-[var(--color-border)] bg-white p-5 text-sm sm:p-6"
      >
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Requirement name</span>
          <input
            name="name"
            required
            placeholder="e.g. Diwali client kits"
            className="mt-1 min-h-11 w-full border px-3 py-2"
          />
        </label>

        <div className="flex items-end gap-2">
          <MobileSheetSelect
            name="company_id"
            label="Company"
            required
            value={companyId}
            onChange={selectCompany}
            className="min-w-0 flex-1"
            emptyLabel="Select company"
            options={[
              { value: '', label: 'Select company' },
              ...companyOptions.map((company) => ({ value: company.id, label: company.name })),
            ]}
          />
          {showAddCompany ? (
            <button type="button" onClick={() => setCompanyOpen(true)} className={addButtonClass}>
              + Add Company
            </button>
          ) : null}
        </div>

        <div>
          <div className="flex items-end gap-2">
            <MobileSheetSelect
              name="contact_id"
              label="Contact"
              value={contactId}
              onChange={setContactId}
              disabled={!companyId}
              className="min-w-0 flex-1"
              emptyLabel={companyId ? 'Optional contact' : 'Select a company first'}
              options={[
                { value: '', label: companyId ? 'Optional contact' : 'Select a company first' },
                ...visibleContacts.map((contact) => ({
                  value: contact.id,
                  label: contact.full_name || 'Contact',
                })),
              ]}
            />
            {showAddContact ? (
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                disabled={!companyId}
                className={addButtonClass}
              >
                + Add Contact
              </button>
            ) : null}
          </div>
          {showAddContact && !companyId ? (
            <p className="mt-1 text-[11px] text-gray-500">Select a company before adding a contact.</p>
          ) : null}
        </div>

        {role === 'admin' && (
          <MobileSheetSelect
            name="owner_id"
            label="Owner"
            defaultValue={currentUserId}
            options={owners.map((owner) => ({
              value: owner.id,
              label: owner.full_name || owner.id,
            }))}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Quantity</span>
            <input
              name="quantity"
              type="number"
              min="1"
              defaultValue={1}
              className="mt-1 min-h-11 w-full border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Budget</span>
            <input
              name="budget"
              type="number"
              min="0"
              step="0.01"
              placeholder="Optional"
              className="mt-1 min-h-11 w-full border px-3 py-2"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SheetDateField name="deadline" label="Deadline" />
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Delivery city</span>
            <input
              name="delivery_city"
              placeholder="Optional"
              className="mt-1 min-h-11 w-full border px-3 py-2"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Purpose</span>
          <input
            name="purpose"
            placeholder="e.g. Onboarding kits, festival gifts"
            className="mt-1 min-h-11 w-full border px-3 py-2"
          />
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

      {showAddCompany ? (
        <QuickCompanyModal open={companyOpen} onClose={() => setCompanyOpen(false)} onCreated={onCompanyCreated} />
      ) : null}
      {showAddContact ? (
        <QuickContactModal
          open={contactOpen && Boolean(companyId)}
          companyId={companyId}
          companyName={selectedCompany?.name || 'this company'}
          onClose={() => setContactOpen(false)}
          onCreated={onContactCreated}
        />
      ) : null}
    </>
  )
}
