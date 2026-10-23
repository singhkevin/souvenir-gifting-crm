import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { appName } from '@/lib/brand'
import { addEmailDomainAllowlist, removeEmailDomainAllowlist, updateOrgSettings } from './actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 text-red-800 p-4">
          <h2 className="font-bold mb-1">Access Denied</h2>
          <p className="text-sm">You must be an administrator to view this page.</p>
        </div>
      </div>
    )
  }

  const { data: settings } = await supabase.from('org_settings').select('*').limit(1).maybeSingle()
  const allowlist = await supabase.from('email_domain_allowlist').select('domain, note').order('domain')
  const { data: owners } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['admin', 'sales'])
    .eq('is_active', true)
    .order('full_name')

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6">Organization Settings</h1>
      <ActionForm action={updateOrgSettings} className="bg-white p-6 border space-y-4 text-sm">
        <label className="block">
          <span className="text-gray-500 text-xs">Organisation name</span>
          <input name="organisation_name" defaultValue={settings?.organisation_name || appName()} className="w-full border px-3 py-2 mt-1" />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs">Default tax percent</span>
          <input name="default_tax_percent" type="number" step="0.01" defaultValue={settings?.default_tax_percent || 18} className="w-full border px-3 py-2 mt-1" />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs">Currency</span>
          <input name="currency" defaultValue={settings?.currency || 'INR'} className="w-full border px-3 py-2 mt-1" />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs">Public contact phone</span>
          <input
            name="public_contact_phone"
            defaultValue={settings?.public_contact_phone || ''}
            placeholder="Business number shown in the public footer and WhatsApp"
            className="w-full border px-3 py-2 mt-1"
          />
          <span className="mt-1 block text-[11px] text-gray-500">
            Leave blank to hide the number. PUBLIC_CONTACT_PHONE overrides this when it is set on the server.
          </span>
        </label>

        <div className="border-t pt-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Prices</h2>
          <p className="text-xs text-gray-500">
            Cost, portal rules, fixed prices and company prices are managed in Pricing. This page keeps the organisation name, tax default and business registration settings.
          </p>
          <a href="/crm/pricing" className="inline-flex text-sm font-medium text-[#806A50] underline">Open Pricing</a>
        </div>

        <div className="border-t pt-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Order lifecycle</h2>
          <p className="text-xs text-gray-500">
            Early mockup approval, short counts, delivery proof and partial deliveries.
          </p>
          <a href="/crm/settings/order-lifecycle" className="inline-flex text-sm font-medium text-[#806A50] underline">Open order lifecycle settings</a>
        </div>

        <div className="border-t pt-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Business quotes</h2>
          <label className="block">
            <span className="text-gray-500 text-xs">Quote validity (days)</span>
            <input
              name="quote_validity_days"
              type="number"
              min="1"
              max="90"
              defaultValue={settings?.quote_validity_days ?? 14}
              className="mt-1 w-full border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-gray-500 text-xs">Default owner for new business accounts</span>
            <select name="business_default_owner_id" defaultValue={settings?.business_default_owner_id || ''} className="mt-1 w-full border px-3 py-2">
              <option value="">Least-loaded salesperson</option>
              {(owners || []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name || owner.email} ({owner.role})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="border-t pt-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Store orders</h2>
          <label className="block">
            <span className="text-gray-500 text-xs">Default owner for public store orders</span>
            <select name="store_default_owner_id" defaultValue={settings?.store_default_owner_id || ''} className="mt-1 w-full border px-3 py-2">
              <option value="">First active admin</option>
              {(owners || []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name || owner.email} ({owner.role})
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-gray-500">
              Guest checkouts are assigned to this person. Leave blank to keep the first active admin.
            </span>
          </label>
        </div>

        <SubmitButton className="px-4 py-2 bg-[#806A50] text-white font-medium text-sm" pendingLabel="Saving…">Save settings</SubmitButton>
      </ActionForm>

      <div className="mt-6 border bg-white p-6 text-sm">
        <h2 className="font-semibold text-gray-900">Work-email allowlist</h2>
        <p className="mt-1 text-xs text-gray-500">
          Business registration blocks free inboxes such as Gmail, Yahoo, and Outlook. Add a domain here to allow it.
        </p>
        {allowlist.error ? (
          <p className="mt-3 text-xs text-amber-800">Apply supabase/migrations/20261018_registration_pricing_samples.sql, then retry.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(allowlist.data || []).length === 0 && <li className="text-xs text-gray-500">No overrides yet.</li>}
            {(allowlist.data || []).map((row) => (
              <li key={row.domain} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-mono">{row.domain}</span>
                  {row.note ? <span className="ml-2 text-xs text-gray-500">{row.note}</span> : null}
                </span>
                <ActionForm action={removeEmailDomainAllowlist}>
                  <input type="hidden" name="domain" value={row.domain} />
                  <button type="submit" className="text-xs text-red-700 underline">Remove</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addEmailDomainAllowlist} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-xs text-gray-500">
            Domain
            <input name="domain" placeholder="acme.com" className="mt-1 w-full border px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs text-gray-500">
            Note
            <input name="note" placeholder="Optional" className="mt-1 w-full border px-3 py-2 text-sm" />
          </label>
          <SubmitButton className="bg-[#806A50] px-3 py-2 text-sm text-white" pendingLabel="Adding…">Add domain</SubmitButton>
        </ActionForm>
      </div>
    </div>
  )
}
