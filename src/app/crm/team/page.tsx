import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { requireStaff } from '@/lib/auth'
import { updateTeamMember } from './actions'
import { asFormAction } from '@/lib/form-action'

export default async function TeamPage() {
  await requireStaff(['admin'])
  const supabase = await createClient()
  const [{ data: profiles }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('departments').select('id, name').order('name'),
  ])

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    management: 'bg-blue-100 text-blue-800',
    sales: 'bg-green-100 text-green-800',
    operations: 'bg-amber-100 text-amber-800',
    accounts: 'bg-indigo-100 text-indigo-800',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6">Team Directory</h1>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Department</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(profiles || []).filter((p) => p.role !== 'client_admin' && p.role !== 'client_user').map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-3 font-medium">{p.full_name}</td>
                <td className="p-3">{p.email}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${roleColors[p.role] || 'bg-gray-100'}`}>{p.role}</span>
                </td>
                <td className="p-3" colSpan={4}>
                  <form action={asFormAction(updateTeamMember)} className="flex flex-wrap gap-2 items-center text-xs">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="role" defaultValue={p.role} className="border rounded px-2 py-1">
                      {['admin', 'sales', 'operations', 'accounts', 'management'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <select name="department_id" defaultValue={p.department_id || ''} className="border rounded px-2 py-1">
                      <option value="">No department</option>
                      {(departments || []).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <select name="is_active" defaultValue={p.is_active === false ? 'false' : 'true'} className="border rounded px-2 py-1">
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                    <button className="underline">Save</button>
                    <span className="text-gray-400">{formatDate(p.created_at)}</span>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
