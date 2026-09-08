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
          <input name="organisation_name" defaultValue={settings?.organisation_name || 'GIFFTER'} className="w-full border rounded-lg px-3 py-2 mt-1" />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs">Default tax percent</span>
          <input name="default_tax_percent" type="number" step="0.01" defaultValue={settings?.default_tax_percent || 18} className="w-full border rounded-lg px-3 py-2 mt-1" />
        </label>
        <label className="block">
          <span className="text-gray-500 text-xs">Currency</span>
          <input name="currency" defaultValue={settings?.currency || 'INR'} className="w-full border rounded-lg px-3 py-2 mt-1" />
        </label>
        <button className="px-4 py-2 bg-[#1A3022] text-white rounded-lg font-medium text-sm">Save settings</button>
      </form>
    </div>
  )
}
