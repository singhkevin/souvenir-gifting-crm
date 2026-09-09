import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { createContact, updateContact, removeContact } from './actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { requireStaff } from '@/lib/auth'
import { CompanyAvatar } from '@/components/ui/avatar'
import { asFormAction } from '@/lib/form-action'
import { oneRelation, asRows } from '@/lib/utils'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-[var(--color-primary)]">Contacts</h1>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200">{error}</div>
      )}

      <form action={asFormAction(createContact)} className="grid gap-3 rounded-2xl border bg-white p-4 text-xs md:grid-cols-3">
        <input name="full_name" required placeholder="Full name" className="rounded-lg border px-2 py-2" />
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
        <input name="designation" placeholder="Designation" className="rounded-lg border px-2 py-2" />
        <input name="email" type="email" placeholder="Email" className="rounded-lg border px-2 py-2" />
        <input name="phone" placeholder="Phone" className="rounded-lg border px-2 py-2" />
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
        <button className="rounded-lg bg-[#1A3022] py-2.5 font-semibold text-white hover:text-white md:col-span-3">Add contact</button>
      </form>

      <form className="flex-1 max-w-md flex gap-2">
        <input type="text" name="search" defaultValue={search} placeholder="Search by name or email..." className="flex-1 px-3 py-2 border rounded-md text-sm" />
        <button type="submit" className="bg-gray-100 px-4 py-2 border rounded-md text-sm">Search</button>
      </form>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[640px]">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Company</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1B2430]/35">
            {contactRows.map((c: ContactRow) => {
              const company = oneRelation(c.company)
              return (
                <tr key={c.id}>
                  <td className="p-3 font-medium align-top">{c.full_name}</td>
                  <td className="p-3 align-top">
                    {company ? (
                      <Link href={`/crm/companies/${company.id}`} className="inline-flex items-center gap-2 hover:underline">
                        <CompanyAvatar name={company.name} logoPath={company.logo_path} size="sm" />
                        {company.name}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="p-3 align-top text-gray-600">{c.email || '—'}</td>
                  <td className="p-3 align-top text-gray-600">{c.phone || '—'}</td>
                  <td className="space-y-2 p-3 align-top text-xs">
                    <form action={asFormAction(updateContact)} className="grid gap-1 max-w-xs">
                      <input type="hidden" name="id" value={c.id} />
                      <input name="full_name" defaultValue={c.full_name} required className="border rounded px-2 py-1" />
                      <MobileSheetSelect
                        name="company_id"
                        label="Company"
                        defaultValue={c.company_id || company?.id || ''}
                        options={companyRows.map((companyOption: CompanyOption) => ({
                          value: companyOption.id,
                          label: companyOption.name,
                        }))}
                      />
                      <input name="email" defaultValue={c.email || ''} className="border rounded px-2 py-1" />
                      <input name="phone" defaultValue={c.phone || ''} className="border rounded px-2 py-1" />
                      <input name="designation" defaultValue={c.designation || ''} placeholder="Designation" className="border rounded px-2 py-1" />
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
                      <button className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white">Save</button>
                    </form>
                    <ConfirmAction
                      title="Delete contact?"
                      confirmLabel="Delete"
                      action={asFormAction(removeContact)}
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
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No contacts in your assigned companies.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
