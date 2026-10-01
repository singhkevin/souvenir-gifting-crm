import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { createRequirement } from '../actions'
import { BackButton } from '@/components/ui/back-button'
import { redirect } from 'next/navigation'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'

export default async function NewRequirementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; company_id?: string }>
}) {
  const profile = await requireStaff(['admin', 'sales', 'management'])
  const { error, company_id: preselectedCompanyId } = await searchParams
  const supabase = await createClient()

  const [{ data: companies }, { data: contacts }, { data: owners }] = await Promise.all([
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('contacts').select('id, full_name, company_id').order('full_name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'sales'])
      .eq('is_active', true)
      .order('full_name'),
  ])

  const handleCreate = async (formData: FormData) => {
    'use server'
    const result = await createRequirement(formData)
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      const companyId = String(formData.get('company_id') || '')
      const qs = new URLSearchParams({ error: result.error })
      if (companyId) qs.set('company_id', companyId)
      redirect(`/crm/requirements/new?${qs.toString()}`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton href="/crm/requirements" label="Back to requirements" />
      <h1 className="mb-6 mt-4 text-2xl font-bold text-[var(--color-primary)]">Add Requirement</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <form
        action={handleCreate}
        className="grid gap-4 rounded-lg border border-[var(--color-border)] bg-white p-5 text-sm shadow-sm sm:p-6"
      >
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Requirement name</span>
          <input
            name="name"
            required
            placeholder="e.g. Diwali client kits"
            className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <MobileSheetSelect
          name="company_id"
          label="Company"
          required
          defaultValue={preselectedCompanyId || ''}
          emptyLabel="Select company"
          options={[
            { value: '', label: 'Select company' },
            ...(companies || []).map((company) => ({ value: company.id, label: company.name })),
          ]}
        />

        <MobileSheetSelect
          name="contact_id"
          label="Contact"
          emptyLabel="Optional contact"
          options={[
            { value: '', label: 'Optional contact' },
            ...(contacts || []).map((contact) => ({
              value: contact.id,
              label: contact.full_name || 'Contact',
            })),
          ]}
        />

        {profile.role === 'admin' && (
          <MobileSheetSelect
            name="owner_id"
            label="Owner"
            defaultValue={profile.id}
            options={(owners || []).map((owner) => ({
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
              className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2"
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
              className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2"
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
              className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Purpose</span>
          <input
            name="purpose"
            placeholder="e.g. Onboarding kits, festival gifts"
            className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Description</span>
          <textarea
            name="description"
            rows={3}
            placeholder="Brief notes for the sales team"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#806A50] px-4 text-sm font-semibold text-[#FFFFFF] hover:bg-[#9C8567]"
        >
          Create Requirement
        </button>
      </form>
    </div>
  )
}
