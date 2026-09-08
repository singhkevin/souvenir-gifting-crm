'use client'

import { formatDate } from '@/lib/utils'
import { updateTeamMember } from '@/app/crm/team/actions'
import { asFormAction } from '@/lib/form-action'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  department_id: string | null
  is_active: boolean | null
  created_at: string
}

type Department = { id: string; name: string }

const ROLE_OPTIONS = ['admin', 'sales', 'operations', 'accounts', 'management'].map((r) => ({
  value: r,
  label: r,
}))

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  management: 'bg-blue-100 text-blue-800',
  sales: 'bg-green-100 text-green-800',
  operations: 'bg-amber-100 text-amber-800',
  accounts: 'bg-indigo-100 text-indigo-800',
}

export function TeamDirectory({
  profiles,
  departments,
}: {
  profiles: Profile[]
  departments: Department[]
}) {
  const departmentOptions = [
    { value: '', label: 'No department' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ]

  const staff = profiles.filter((p) => p.role !== 'client_admin' && p.role !== 'client_user')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">Team Directory</h1>

      <div className="space-y-4 md:hidden">
        {staff.map((p) => (
          <article key={p.id} className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-[#1C1917]">{p.full_name}</p>
              <p className="mt-0.5 text-xs text-gray-500">{p.email}</p>
              <span
                className={`mt-2 inline-block rounded px-2 py-1 text-[11px] font-medium uppercase ${
                  roleColors[p.role] || 'bg-gray-100'
                }`}
              >
                {p.role}
              </span>
            </div>
            <form action={asFormAction(updateTeamMember)} className="grid gap-2 border-t border-[#EFE9E0] pt-3">
              <input type="hidden" name="id" value={p.id} />
              <MobileSheetSelect name="role" label="Role" defaultValue={p.role} options={ROLE_OPTIONS} />
              <MobileSheetSelect
                name="department_id"
                label="Department"
                defaultValue={p.department_id || ''}
                options={departmentOptions}
                emptyLabel="No department"
              />
              <MobileSheetSelect
                name="is_active"
                label="Status"
                defaultValue={p.is_active === false ? 'false' : 'true'}
                options={STATUS_OPTIONS}
              />
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white"
              >
                Save
              </button>
              <p className="text-[11px] text-gray-400">Joined {formatDate(p.created_at)}</p>
            </form>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border bg-white md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Department</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {staff.map((p) => (
              <tr key={p.id} className="border-b align-top">
                <td className="p-3 font-medium">{p.full_name}</td>
                <td className="p-3">{p.email}</td>
                <td className="p-3">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium uppercase ${
                      roleColors[p.role] || 'bg-gray-100'
                    }`}
                  >
                    {p.role}
                  </span>
                </td>
                <td className="p-3" colSpan={4}>
                  <form action={asFormAction(updateTeamMember)} className="flex flex-wrap items-center gap-2 text-xs">
                    <input type="hidden" name="id" value={p.id} />
                    <MobileSheetSelect name="role" label="Role" defaultValue={p.role} options={ROLE_OPTIONS} />
                    <MobileSheetSelect
                      name="department_id"
                      label="Department"
                      defaultValue={p.department_id || ''}
                      options={departmentOptions}
                      emptyLabel="No department"
                    />
                    <MobileSheetSelect
                      name="is_active"
                      label="Status"
                      defaultValue={p.is_active === false ? 'false' : 'true'}
                      options={STATUS_OPTIONS}
                    />
                    <button
                      type="submit"
                      className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white"
                    >
                      Save
                    </button>
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
