import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { createCompany } from '../actions'
import { BackButton } from '@/components/ui/back-button'
import { asFormAction } from '@/lib/form-action'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

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
    <div className="mx-auto max-w-3xl">
      <BackButton href="/crm/companies" label="Back to companies" />
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6 mt-4">Add New Company</h1>

      <form action={asFormAction(createCompany)} className="bg-white p-6 rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Company Name *</label>
            <input type="text" name="name" required className="w-full p-2 border border-[var(--color-border)] rounded" />
          </div>
          <MobileSheetSelect
            name="industry"
            label="Industry"
            showDesktopLabel
            emptyLabel="Select Industry"
            options={[
              { value: '', label: 'Select Industry' },
              { value: 'IT', label: 'IT' },
              { value: 'Finance', label: 'Finance' },
              { value: 'Healthcare', label: 'Healthcare' },
              { value: 'Retail', label: 'Retail' },
              { value: 'Manufacturing', label: 'Manufacturing' },
              { value: 'Other', label: 'Other' },
            ]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Website</label>
          <input type="url" name="website" placeholder="https://" className="w-full p-2 border border-[var(--color-border)] rounded" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Company margin %</label>
            <input
              type="number"
              name="margin_percent"
              step="0.01"
              min="0"
              placeholder="Leave empty for org B2B default"
              className="w-full p-2 border border-[var(--color-border)] rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Allowed portal email domains</label>
            <input
              type="text"
              name="allowed_email_domains"
              placeholder="acme.com, acme.co.in"
              className="w-full p-2 border border-[var(--color-border)] rounded"
            />
            <p className="text-[11px] text-gray-500 mt-1">Optional. When set, portal logins must use these domains.</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Portal address</label>
            <input
              type="text"
              name="portal_slug"
              placeholder="acme"
              className="w-full p-2 border border-[var(--color-border)] rounded"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Optional. Becomes https://{'{slug}'}.giftingstore.online — usually live in a few minutes (SSL can take up to 2 hours). Leave empty for the main site only.
            </p>
            <label className="mt-2 flex items-start gap-2 text-[11px] text-gray-600">
              <input type="checkbox" name="notify_client_admins_on_live" value="1" className="mt-0.5" />
              <span>Email client admins when the portal goes live</span>
            </label>
          </div>
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
          <MobileSheetSelect
            name="owner_id"
            label="Assigned salesperson"
            showDesktopLabel
            defaultValue={profile.id}
            options={(owners || []).map((o) => ({ value: o.id, label: o.full_name || o.id }))}
          />
          <MobileSheetSelect
            name="status"
            label="Status"
            showDesktopLabel
            defaultValue="active"
            options={[
              { value: 'prospect', label: 'Prospect' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
          <MobileSheetSelect
            name="portal_status"
            label="Portal status"
            showDesktopLabel
            defaultValue="active"
            options={[
              { value: 'trial', label: 'Trial' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Trial ends</label>
          <input type="datetime-local" name="trial_ends_at" className="w-full p-2 border border-[var(--color-border)] rounded" />
          <p className="text-[11px] text-gray-500 mt-1">Optional. Used when portal status is Trial.</p>
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
