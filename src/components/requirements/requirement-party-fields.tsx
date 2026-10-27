'use client'

import { useState } from 'react'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { QuickAddCompanyButton, QuickAddContactButton } from '@/components/companies/quick-create-modal'

type CompanyOption = { id: string; name: string }
type ContactOption = { id: string; full_name: string | null; company_id: string | null }

export function RequirementPartyFields({
  companies: initialCompanies,
  contacts: initialContacts,
  defaultCompanyId = '',
  canAddCompany,
  canAddContact,
}: {
  companies: CompanyOption[]
  contacts: ContactOption[]
  defaultCompanyId?: string
  canAddCompany: boolean
  canAddContact: boolean
}) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [contacts, setContacts] = useState(initialContacts)
  const [companyId, setCompanyId] = useState(defaultCompanyId)
  const [contactId, setContactId] = useState('')

  const companyContacts = companyId
    ? contacts.filter((contact) => contact.company_id === companyId)
    : []
  const companyName = companies.find((company) => company.id === companyId)?.name || ''

  function chooseCompany(next: string) {
    setCompanyId(next)
    setContactId((current) => {
      const selected = contacts.find((contact) => contact.id === current)
      return selected?.company_id === next ? current : ''
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <MobileSheetSelect
          name="company_id"
          label="Company"
          required
          showDesktopLabel
          className="min-w-0 flex-1"
          value={companyId}
          onChange={chooseCompany}
          emptyLabel="Select company"
          options={[
            { value: '', label: 'Select company' },
            ...companies.map((company) => ({ value: company.id, label: company.name })),
          ]}
        />
        {canAddCompany ? (
          <QuickAddCompanyButton
            onCreated={(company) => {
              setCompanies((current) =>
                [...current.filter((row) => row.id !== company.id), company].sort((a, b) =>
                  a.name.localeCompare(b.name, 'en'),
                ),
              )
              setCompanyId(company.id)
              setContactId('')
            }}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <MobileSheetSelect
          name="contact_id"
          label="Contact"
          showDesktopLabel
          className="min-w-0 flex-1"
          value={contactId}
          onChange={setContactId}
          disabled={!companyId}
          emptyLabel={companyId ? 'Optional contact' : 'Select a company first'}
          options={[
            { value: '', label: companyId ? 'Optional contact' : 'Select a company first' },
            ...companyContacts.map((contact) => ({
              value: contact.id,
              label: contact.full_name || 'Contact',
            })),
          ]}
        />
        {canAddContact ? (
          <QuickAddContactButton
            companyId={companyId}
            companyName={companyName}
            onCreated={(contact) => {
              setContacts((current) =>
                [...current.filter((row) => row.id !== contact.id), contact].sort((a, b) =>
                  (a.full_name || '').localeCompare(b.full_name || '', 'en'),
                ),
              )
              setContactId(contact.id)
            }}
          />
        ) : null}
      </div>
    </>
  )
}
