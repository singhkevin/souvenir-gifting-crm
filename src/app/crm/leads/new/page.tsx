import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { createLead } from '../actions'
import { BackButton } from '@/components/ui/back-button'
import { redirect } from 'next/navigation'

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
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6 mt-4">Add Lead</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <form action={handleCreate} className="bg-white p-6 rounded-lg border border-[var(--color-border)] shadow-sm grid gap-4 text-sm">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Company *</span>
          <select name="company_id" required className="mt-1 w-full p-2 border rounded-lg bg-white">
            <option value="">Select company</option>
            {(companies || []).map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Contact</span>
          <select name="contact_id" className="mt-1 w-full p-2 border rounded-lg bg-white">
            <option value="">Optional contact</option>
            {(contacts || []).map((contact) => (
              <option key={contact.id} value={contact.id}>{contact.full_name}</option>
            ))}
          </select>
        </label>
        {profile.role === 'admin' && (
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Owner</span>
            <select name="owner_id" defaultValue={profile.id} className="mt-1 w-full p-2 border rounded-lg bg-white">
              {(owners || []).map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.full_name || owner.id}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Source</span>
          <select name="source" className="mt-1 w-full p-2 border rounded-lg bg-white">
            <option value="">Select source</option>
            <option value="referral">Referral</option>
            <option value="website">Website</option>
            <option value="direct">Direct</option>
            <option value="social_media">Social media</option>
            <option value="event">Event</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Estimated value</span>
          <input name="estimated_value" type="number" min="0" step="0.01" className="mt-1 w-full p-2 border rounded-lg" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Notes</span>
          <textarea name="notes" rows={3} className="mt-1 w-full p-2 border rounded-lg" />
        </label>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#4A235A]">
          Create lead
        </button>
      </form>
    </div>
  )
}
