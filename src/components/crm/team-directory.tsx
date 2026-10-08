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
  company_id: string | null
  department_id: string | null
  is_active: boolean | null
  created_at: string
}

type Department = { id: string; name: string }

type DepartmentOption = { value: string; label: string }

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

const CLIENT_ROLES = new Set(['client_admin', 'client_user'])

function isPendingAccount(profile: Profile) {
  return CLIENT_ROLES.has(profile.role) && profile.company_id == null
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-1 text-[11px] font-medium uppercase md:text-xs ${
        roleColors[role] || 'bg-gray-100'
      }`}
    >
      {role}
    </span>
  )
}

function MemberForm({
  profile,
  departmentOptions,
  pending,
  variant,
}: {
  profile: Profile
  departmentOptions: DepartmentOption[]
  pending: boolean
  variant: 'card' | 'table'
}) {
  const compact = variant === 'table'
  return (
    <form
      action={asFormAction(updateTeamMember)}
      className={
        compact
          ? 'flex flex-wrap items-center gap-2 text-xs'
          : 'grid gap-2 border-t border-[#EFE9E0] pt-3'
      }
    >
      <input type="hidden" name="id" value={profile.id} />
      <MobileSheetSelect
        name="role"
        label="Role"
        defaultValue={pending ? '' : profile.role}
        options={ROLE_OPTIONS}
        emptyLabel={pending ? 'Select role' : 'Select'}
        required={pending}
      />
      <MobileSheetSelect
        name="department_id"
        label="Department"
        defaultValue={profile.department_id || ''}
        options={departmentOptions}
        emptyLabel="No department"
      />
      <MobileSheetSelect
        name="is_active"
        label="Status"
        defaultValue={profile.is_active === false ? 'false' : 'true'}
        options={STATUS_OPTIONS}
      />
      <button
        type="submit"
        className={`inline-flex items-center justify-center rounded-lg bg-[#806A50] px-3 text-xs font-semibold text-[#FFFFFF] hover:bg-[#9C8567] hover:text-[#FFFFFF] ${
          compact ? 'min-h-9' : 'min-h-10'
        }`}
      >
        Save
      </button>
      {compact ? (
        <span className="text-gray-400">{formatDate(profile.created_at)}</span>
      ) : (
        <p className="text-[11px] text-gray-400">Joined {formatDate(profile.created_at)}</p>
      )}
    </form>
  )
}

function MemberCard({
  profile,
  departmentOptions,
  pending,
}: {
  profile: Profile
  departmentOptions: DepartmentOption[]
  pending: boolean
}) {
  return (
    <article className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-[#1C1917]">{profile.full_name}</p>
        <p className="mt-0.5 text-xs text-gray-500">{profile.email}</p>
        <span className="mt-2 inline-block">
          <RoleBadge role={profile.role} />
        </span>
      </div>
      <MemberForm
        profile={profile}
        departmentOptions={departmentOptions}
        pending={pending}
        variant="card"
      />
    </article>
  )
}

function MemberTable({
  profiles,
  departmentOptions,
  pending,
}: {
  profiles: Profile[]
  departmentOptions: DepartmentOption[]
  pending: boolean
}) {
  return (
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
          {profiles.map((profile) => (
            <tr key={profile.id} className="border-b align-top">
              <td className="p-3 font-medium">{profile.full_name}</td>
              <td className="p-3">{profile.email}</td>
              <td className="p-3">
                <RoleBadge role={profile.role} />
              </td>
              <td className="p-3" colSpan={4}>
                <MemberForm
                  profile={profile}
                  departmentOptions={departmentOptions}
                  pending={pending}
                  variant="table"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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

  const pending = profiles.filter(isPendingAccount)
  const staff = profiles.filter((p) => !CLIENT_ROLES.has(p.role))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">Team Directory</h1>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1C1917]">Pending accounts (no role assigned)</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Self sign-ups and users added in the Supabase dashboard start here. Pick a staff role to
            promote them; leave them alone if they are not staff.
          </p>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">No pending accounts.</p>
        ) : (
          <>
            <div className="space-y-4 md:hidden">
              {pending.map((profile) => (
                <MemberCard
                  key={profile.id}
                  profile={profile}
                  departmentOptions={departmentOptions}
                  pending
                />
              ))}
            </div>
            <MemberTable profiles={pending} departmentOptions={departmentOptions} pending />
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#1C1917]">Staff</h2>
        <div className="space-y-4 md:hidden">
          {staff.map((profile) => (
            <MemberCard
              key={profile.id}
              profile={profile}
              departmentOptions={departmentOptions}
              pending={false}
            />
          ))}
        </div>
        <MemberTable profiles={staff} departmentOptions={departmentOptions} pending={false} />
      </section>
    </div>
  )
}
