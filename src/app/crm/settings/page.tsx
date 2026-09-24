import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateOrgSettings } from './actions'
import { asFormAction } from '@/lib/form-action'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          <h2 className="font-bold mb-1">Access Denied</h2>
          <p className="text-sm">You must be an administrator to view this page.</p>
        </div>
      </div>
    )
  }

  const { data: settings } = await supabase.from('org_settings').select('*').limit(1).maybeSingle()

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6">Organization Settings</h1>
      <form action={asFormAction(updateOrgSettings)} className="bg-white p-6 rounded-lg border space-y-4 text-sm">
        <label className="block">
          <span className="text-gray-500 text-xs">Organisation name</span>
          <input name="organisation_name" defaultValue={settings?.organisation_name || 'Souvenir - Gifting Solutions'} className="w-full border rounded-lg px-3 py-2 mt-1" />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs">Default tax percent</span>
          <input name="default_tax_percent" type="number" step="0.01" defaultValue={settings?.default_tax_percent || 18} className="w-full border rounded-lg px-3 py-2 mt-1" />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs">Currency</span>
          <input name="currency" defaultValue={settings?.currency || 'INR'} className="w-full border rounded-lg px-3 py-2 mt-1" />
        </label>

        <div className="border-t pt-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Sell-price margins (%)</h2>
            <p className="text-xs text-gray-500 mt-1">
              Customer price = supplier cost (or list price if cost is blank) × (1 + margin%).
              Public store uses the B2C %. Corporate catalogue uses that company’s %, then the B2B %.
              A product margin % is used only when the channel % is blank.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-gray-500 text-xs">Global fallback %</span>
              <input
                name="default_margin_percent"
                type="number"
                step="0.01"
                min="0"
                defaultValue={settings?.default_margin_percent ?? 35}
                className="w-full border rounded-lg px-3 py-2 mt-1"
              />
            </label>
            <label className="block">
              <span className="text-gray-500 text-xs">Public / B2C %</span>
              <input
                name="b2c_margin_percent"
                type="number"
                step="0.01"
                min="0"
                defaultValue={settings?.b2c_margin_percent ?? 40}
                className="w-full border rounded-lg px-3 py-2 mt-1"
              />
            </label>
            <label className="block">
              <span className="text-gray-500 text-xs">Corporate / B2B default %</span>
              <input
                name="b2b_margin_percent"
                type="number"
                step="0.01"
                min="0"
                defaultValue={settings?.b2b_margin_percent ?? 35}
                className="w-full border rounded-lg px-3 py-2 mt-1"
              />
            </label>
          </div>
        </div>

        <button className="px-4 py-2 bg-[#806A50] text-white rounded-lg font-medium text-sm">Save settings</button>
      </form>
    </div>
  )
}
