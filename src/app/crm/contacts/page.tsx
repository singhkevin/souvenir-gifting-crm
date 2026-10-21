import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { createContact, updateContact, removeContact } from './actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { requireStaff } from '@/lib/auth'
import { CompanyAvatar } from '@/components/ui/avatar'
import { oneRelation, asRows } from '@/lib/utils'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

type CompanyOption = { id: string; name: string; logo_path: string | null }
type ContactRow = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  designation?: string | null
  contact_type?: string | null
  company_id?: string
  company?: CompanyOption | CompanyOption[] | null
}

export default async function ContactsPage(props: { searchParams: Promise<{ search?: string; error?: string }> }) {
  const profile = await requireStaff(['admin', 'sales', 'management'])
  const searchParams = await props.searchParams
  const search = searchParams.search || ''
  const error = searchParams.error || ''

  const supabase = await createClient()
  const companiesQuery = supabase.from('companies').select('id, name, logo_path').order('name')
  const { data: companies } = await (
    profile.role === 'admin' ||
    profile.role === 'management' ||
    profile.role === 'accounts' ||
    profile.role === 'operations'
      ? companiesQuery
      : companiesQuery.eq('owner_id', profile.id)
  )
  const companyRows = asRows<CompanyOption>(companies)
  const companyIds = companyRows.map((c: CompanyOption) => c.id)

  const contactsSelect = 'id, full_name, email, phone, designation, contact_type, company_id, company:companies(id, name, logo_path)'
  const contactsByCompany = companyIds.length > 0
    ? supabase.from('contacts').select(contactsSelect).order('full_name').in('company_id', companyIds)
    : supabase.from('contacts').select(contactsSelect).order('full_name').eq('company_id', '00000000-0000-0000-0000-000000000000')
  const { data: contacts } = search
    ? await contactsByCompany.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    : await contactsByCompany
  const contactRows = asRows<ContactRow>(contacts)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
              Contacts
            </h1>
            <span className="font-mono text-xs text-[#7C766F]">[ {contactRows.length} ]</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#BA1A1A]/10 text-[#BA1A1A] text-xs rounded-none border border-[#BA1A1A]/40">{error}</div>
      )}

      {/* Add Contact Form */}
      <ActionForm action={createContact} className="grid gap-3 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4 text-xs md:grid-cols-3" resetOnSuccess>
        <input
          name="full_name"
          required
          placeholder="Full name"
          className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
        />
        <MobileSheetSelect
          name="company_id"
          label="Company"
          required
          emptyLabel="Company"
          options={[
            { value: '', label: 'Company' },
            ...companyRows.map((c: CompanyOption) => ({ value: c.id, label: c.name })),
          ]}
        />
        <input
          name="designation"
          placeholder="Designation"
          className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
        />
        <input
          name="phone"
          placeholder="Phone"
          className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
        />
        <MobileSheetSelect
          name="contact_type"
          label="Contact type"
          defaultValue="primary"
          options={[
            { value: 'primary', label: 'Primary' },
            { value: 'billing', label: 'Billing' },
            { value: 'procurement', label: 'Procurement' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <SubmitButton
          className="rounded-none bg-[#1C1B1A] py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] hover:text-[#FCF9F2] md:col-span-3 transition-colors"
          pendingLabel="Adding…"
        >
          Add contact
        </SubmitButton>
      </ActionForm>

      {/* Search Toolbar */}
      <form className="max-w-md flex gap-2">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search by name or email..."
          className="flex-1 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
        />
        <button
          type="submit"
          className="rounded-none border border-[#1C1B1A] bg-transparent px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#F6F3EC] transition-colors"
        >
          Search
        </button>
      </form>

      {/* Mobile Card List */}
      <div className="space-y-3 md:hidden">
        {contactRows.map((c: ContactRow) => {
          const company = oneRelation(c.company)
          return (
            <div key={c.id} className="bg-[#FCF9F2] border border-[#CCC5BD] p-4 rounded-none space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-[#1C1B1A]">{c.full_name}</div>
                  {c.designation ? <div className="text-xs text-[#7C766F]">{c.designation}</div> : null}
                </div>
                {c.contact_type ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] rounded-none border border-[#CCC5BD] text-[#4A4640] bg-transparent">
                    {c.contact_type}
                  </span>
                ) : null}
              </div>

              <div className="text-xs space-y-1.5 pt-2 border-t border-[#CCC5BD] text-[#4A4640]">
                {company ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company:</span>
                    <Link href={`/crm/companies/${company.id}`} className="inline-flex items-center gap-1.5 text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                      <CompanyAvatar name={company.name} logoPath={company.logo_path} size="sm" />
                      <span>{company.name}</span>
                    </Link>
                  </div>
                ) : null}
                {c.email ? (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Email:</span>{' '}
                    <span className="font-mono text-xs text-[#1C1B1A]">{c.email}</span>
                  </div>
                ) : null}
                {c.phone ? (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Phone:</span>{' '}
                    <span className="font-mono text-xs text-[#1C1B1A]">{c.phone}</span>
                  </div>
                ) : null}
              </div>

              <div className="pt-2 border-t border-[#CCC5BD] space-y-2">
                <ActionForm action={updateContact} className="grid gap-1.5">
                  <input type="hidden" name="id" value={c.id} />
                  <input
                    name="full_name"
                    defaultValue={c.full_name}
                    required
                    className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                  <MobileSheetSelect
                    name="company_id"
                    label="Company"
                    defaultValue={c.company_id || company?.id || ''}
                    options={companyRows.map((companyOption: CompanyOption) => ({
                      value: companyOption.id,
                      label: companyOption.name,
                    }))}
                  />
                  <input
                    name="email"
                    defaultValue={c.email || ''}
                    className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                  <input
                    name="phone"
                    defaultValue={c.phone || ''}
                    className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                  <input
                    name="designation"
                    defaultValue={c.designation || ''}
                    placeholder="Designation"
                    className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                  <MobileSheetSelect
                    name="contact_type"
                    label="Contact type"
                    defaultValue={c.contact_type || 'primary'}
                    options={[
                      { value: 'primary', label: 'Primary' },
                      { value: 'billing', label: 'Billing' },
                      { value: 'procurement', label: 'Procurement' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
                  <SubmitButton
                    className="inline-flex min-h-8 items-center justify-center rounded-none bg-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] hover:text-[#FCF9F2] transition-colors"
                    pendingLabel="Saving…"
                  >
                    Save
                  </SubmitButton>
                </ActionForm>
                <ConfirmAction
                  title="Delete contact?"
                  confirmLabel="Delete"
                  action={removeContact}
                  hiddenFields={{ id: c.id }}
                  description={<p>Contact: <span className="font-semibold">{c.full_name}</span></p>}
                >
                  Delete
                </ConfirmAction>
              </div>
            </div>
          )
        })}
        {contactRows.length === 0 && (
          <div className="p-8 text-center text-sm text-[#7C766F] bg-[#FCF9F2] border border-[#CCC5BD] rounded-none">
            No contacts in your assigned companies.
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-[#FCF9F2] border border-[#CCC5BD] rounded-none overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[640px] border-collapse">
          <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
            <tr>
              <th className="py-3 px-4 font-bold text-left">Name</th>
              <th className="py-3 px-4 font-bold text-left">Company</th>
              <th className="py-3 px-4 font-bold text-left">Email</th>
              <th className="py-3 px-4 font-bold text-left">Phone</th>
              <th className="py-3 px-4 font-bold text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD]">
            {contactRows.map((c: ContactRow) => {
              const company = oneRelation(c.company)
              return (
                <tr key={c.id} className="hover:bg-[#F6F3EC] transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-sm text-[#1C1B1A] align-top">
                    {c.full_name}
                    {c.designation ? <div className="text-xs font-normal text-[#7C766F] mt-0.5">{c.designation}</div> : null}
                  </td>
                  <td className="py-2.5 px-4 align-top">
                    {company ? (
                      <Link href={`/crm/companies/${company.id}`} className="inline-flex items-center gap-2 text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                        <CompanyAvatar name={company.name} logoPath={company.logo_path} size="sm" />
                        <span className="font-medium text-sm">{company.name}</span>
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="py-2.5 px-4 align-top font-mono text-xs text-[#4A4640]">{c.email || '—'}</td>
                  <td className="py-2.5 px-4 align-top font-mono text-xs text-[#4A4640]">{c.phone || '—'}</td>
                  <td className="space-y-2 py-2.5 px-4 align-top text-xs">
                    <ActionForm action={updateContact} className="grid gap-1.5 max-w-xs">
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        name="full_name"
                        defaultValue={c.full_name}
                        required
                        className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                      />
                      <MobileSheetSelect
                        name="company_id"
                        label="Company"
                        defaultValue={c.company_id || company?.id || ''}
                        options={companyRows.map((companyOption: CompanyOption) => ({
                          value: companyOption.id,
                          label: companyOption.name,
                        }))}
                      />
                      <input
                        name="email"
                        defaultValue={c.email || ''}
                        className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                      />
                      <input
                        name="phone"
                        defaultValue={c.phone || ''}
                        className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                      />
                      <input
                        name="designation"
                        defaultValue={c.designation || ''}
                        placeholder="Designation"
                        className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                      />
                      <MobileSheetSelect
                        name="contact_type"
                        label="Contact type"
                        defaultValue={c.contact_type || 'primary'}
                        options={[
                          { value: 'primary', label: 'Primary' },
                          { value: 'billing', label: 'Billing' },
                          { value: 'procurement', label: 'Procurement' },
                          { value: 'other', label: 'Other' },
                        ]}
                      />
                      <SubmitButton
                        className="inline-flex min-h-8 items-center justify-center rounded-none bg-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] hover:text-[#FCF9F2] transition-colors"
                        pendingLabel="Saving…"
                      >
                        Save
                      </SubmitButton>
                    </ActionForm>
                    <ConfirmAction
                      title="Delete contact?"
                      confirmLabel="Delete"
                      action={removeContact}
                      hiddenFields={{ id: c.id }}
                      description={<p>Contact: <span className="font-semibold">{c.full_name}</span></p>}
                    >
                      Delete
                    </ConfirmAction>
                  </td>
                </tr>
              )
            })}
            {contactRows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-[#7C766F]">
                  No contacts in your assigned companies.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
