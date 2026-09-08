import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { createLead } from '../actions'
import { BackButton } from '@/components/ui/back-button'
import { redirect } from 'next/navigation'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const profile = await requireStaff(['admin', 'sales', 'management'])
  const { error } = await searchParams
  const supabase = await createClient()

  const [{ data: companies }, { data: contacts }, { data: owners }] = await Promise.all([
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('contacts').select('id, full_name, company_id').order('full_name'),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales']).eq('is_active', true).order('full_name'),
  ])

  const handleCreate = async (formData: FormData) => {
    'use server'
    const result = await createLead(formData)
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      redirect(`/crm/leads/new?error=${encodeURIComponent(result.error)}`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton href="/crm/leads" label="Back to leads" />
      <h1 className="mb-6 mt-4 text-2xl font-bold text-[var(--color-primary)]">Add Lead</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <form action={handleCreate} className="grid gap-4 rounded-lg border border-[var(--color-border)] bg-white p-5 text-sm shadow-sm sm:p-6">
        <MobileSheetSelect
          name="company_id"
          label="Company"
          required
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
            ...(contacts || []).map((contact) => ({ value: contact.id, label: contact.full_name || 'Contact' })),
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
        <MobileSheetSelect
          name="source"
          label="Source"
          emptyLabel="Select source"
          options={[
            { value: '', label: 'Select source' },
            { value: 'referral', label: 'Referral' },
            { value: 'website', label: 'Website' },
            { value: 'direct', label: 'Direct' },
            { value: 'social_media', label: 'Social media' },
            { value: 'event', label: 'Event' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Estimated value</span>
          <input name="estimated_value" type="number" min="0" step="0.01" className="mt-1 min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Notes</span>
          <textarea name="notes" rows={3} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1A3022] px-4 text-sm font-semibold text-white hover:bg-[#274433]">
          Create Lead
        </button>
      </form>
    </div>
  )
}
