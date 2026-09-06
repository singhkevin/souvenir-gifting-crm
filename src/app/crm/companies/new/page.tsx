import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { createCompany } from '../actions'
import { BackButton } from '@/components/ui/back-button'
import { asFormAction } from '@/lib/form-action'

export default async function NewCompanyPage() {
  const profile = await requireStaff(['admin', 'sales'])
  const supabase = await createClient()
  const { data: owners } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['admin', 'sales'])
    .eq('is_active', true)
    .order('full_name')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <BackButton href="/crm/companies" label="Back to companies" />
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6 mt-4">Add New Company</h1>

      <form action={asFormAction(createCompany)} className="bg-white p-6 rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Company Name *</label>
            <input type="text" name="name" required className="w-full p-2 border border-[var(--color-border)] rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Industry</label>
            <select name="industry" className="w-full p-2 border border-[var(--color-border)] rounded">
              <option value="">Select Industry</option>
              <option value="IT">IT</option>
              <option value="Finance">Finance</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Retail">Retail</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Website</label>
          <input type="url" name="website" placeholder="https://" className="w-full p-2 border border-[var(--color-border)] rounded" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input type="text" name="city" className="w-full p-2 border border-[var(--color-border)] rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">State</label>
            <input type="text" name="state" className="w-full p-2 border border-[var(--color-border)] rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <input type="text" name="country" defaultValue="India" className="w-full p-2 border border-[var(--color-border)] rounded" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea name="address" rows={3} className="w-full p-2 border border-[var(--color-border)] rounded" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Assigned salesperson</label>
            <select name="owner_id" defaultValue={profile.id} className="w-full p-2 border border-[var(--color-border)] rounded">
              {(owners || []).map((o) => (
                <option key={o.id} value={o.id}>{o.full_name || o.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select name="status" defaultValue="active" className="w-full p-2 border border-[var(--color-border)] rounded">
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Company logo</label>
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="w-full text-sm" />
          <p className="text-[11px] text-gray-500 mt-1">PNG, JPG or WebP. 2 MB max. If this company matches an existing record, its logo may be reused — you can still upload your own.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea name="notes" rows={3} className="w-full p-2 border border-[var(--color-border)] rounded" />
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <a href="/crm/companies" className="px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50">
            Cancel
          </a>
          <button type="submit" className="px-6 py-2 bg-[var(--color-primary)] text-white hover:text-white rounded font-medium hover:opacity-90">
            Create Company
          </button>
        </div>
      </form>
    </div>
  )
}
