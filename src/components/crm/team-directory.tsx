'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { addTeamMember, updateTeamMember } from '@/app/crm/team/actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
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

// 'runner' (delivery runner, sees only /crm/runs) needs migration 20261023_runner_role_enum.sql.
const ROLE_OPTIONS = ['admin', 'sales', 'operations', 'accounts', 'management', 'runner'].map((r) => ({
  value: r,
  label: r === 'runner' ? 'runner · deliveries only' : r,
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
  runner: 'bg-teal-100 text-teal-800',
}

const STAFF_ROLE_SET = new Set(ROLE_OPTIONS.map((o) => o.value))

const OTHER_ROLE_LABELS: Record<string, string> = {
  business_user: 'Business portal',
  gift_employee: 'Gift portal employee',
}

const inputClass =
  'w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0'

function CreatedLogin({ email, password, onDone }: { email: string; password: string; onDone: () => void }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="md:col-span-2 space-y-3 border border-[#CCC5BD] bg-[#F6F3EC] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A]">Team member added</p>
      <p className="text-[11px] text-[#7C766F]">
        No email was sent. Share these details yourself. The password is not stored in the CRM and cannot be shown again.
      </p>
      <p className="text-xs">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Login email</span>
        <span className="font-mono text-[#1C1B1A]">{email}</span>
      </p>
      <p className="text-xs">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Temporary password · share securely</span>
        <span className="font-mono text-[#1C1B1A]">{revealed ? password : '••••••••'}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setRevealed((v) => !v)} className="border border-[#1C1B1A] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:bg-[#FCF9F2]">
          {revealed ? 'Hide' : 'Reveal once'}
        </button>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(`${email}\n${password}`)
            toast.success('Copied')
          }}
          className="border border-[#1C1B1A] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:bg-[#FCF9F2]"
        >
          Copy
        </button>
        <button type="button" onClick={onDone} className="bg-[#1C1B1A] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#FCF9F2] hover:bg-[#9E4300]">
          Done
        </button>
      </div>
    </div>
  )
}

function AddMemberForm({ departmentOptions }: { departmentOptions: DepartmentOption[] }) {
  const [formKey, setFormKey] = useState(0)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  const create = async (formData: FormData) => {
    const result = await addTeamMember(formData)
    if (result?.error) return { error: result.error }
    if (result?.success && result.email && result.temporaryPassword) {
      return { email: result.email, temporaryPassword: result.temporaryPassword }
    }
    return { error: 'Team member was not added.' }
  }

  return (
    <div className="space-y-3">
      <ActionForm
        key={formKey}
        action={create}
        successMessage="Team member added"
        onSuccess={(result) => {
          const r = result as { email?: string; temporaryPassword?: string } | undefined
          if (r?.email && r.temporaryPassword) setCreated({ email: r.email, password: r.temporaryPassword })
          setFormKey((k) => k + 1)
        }}
        className="grid gap-3 border border-[#E8E4DE] bg-white p-4 text-xs md:grid-cols-2"
      >
        <label className="block space-y-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Full name</span>
          <input name="full_name" required placeholder="Full name" className={inputClass} />
        </label>
        <label className="block space-y-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Login email</span>
          <input name="email" type="email" required placeholder="name@company.com" className={`${inputClass} font-mono`} />
        </label>
        <MobileSheetSelect name="role" label="Role" showDesktopLabel options={ROLE_OPTIONS} emptyLabel="Select role" required />
        <MobileSheetSelect
          name="department_id"
          label="Department"
          showDesktopLabel
          defaultValue=""
          options={departmentOptions.filter((o) => o.value)}
          emptyLabel="No department"
        />
        <label className="block space-y-1 md:col-span-2">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Temporary password</span>
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Leave empty to generate one (min 8)"
            className={`${inputClass} font-mono`}
          />
        </label>
        <p className="text-[11px] text-[#7C766F] md:col-span-2">
          Creates the login straight away. No invite email is sent; you share the login yourself.
        </p>
        {created && (
          <CreatedLogin email={created.email} password={created.password} onDone={() => setCreated(null)} />
        )}
        <SubmitButton
          pendingLabel="Adding…"
          className="bg-[#1C1B1A] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] md:col-span-2"
        >
          Add team member
        </SubmitButton>
      </ActionForm>
    </div>
  )
}

const CLIENT_ROLES = new Set(['client_admin', 'client_user'])

function isPendingAccount(profile: Profile) {
  return CLIENT_ROLES.has(profile.role) && profile.company_id == null
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-block  px-2 py-1 text-[11px] font-medium uppercase md:text-xs ${
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
  const [role, setRole] = useState(pending ? '' : profile.role)
  const saveBlocked = pending && role === ''
  return (
    <ActionForm
      action={updateTeamMember}
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
        value={role}
        onChange={setRole}
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
      <SubmitButton
        pendingLabel="Saving…"
        disabled={saveBlocked}
        className={`inline-flex items-center justify-center  bg-[#806A50] px-3 text-xs font-semibold text-[#FFFFFF] hover:bg-[#9C8567] hover:text-[#FFFFFF] disabled:cursor-not-allowed disabled:opacity-50 ${
          compact ? 'min-h-9' : 'min-h-10'
        }`}
      >
        Save
      </SubmitButton>
      {compact ? (
        <span className="text-gray-400">{formatDate(profile.created_at)}</span>
      ) : (
        <p className="text-[11px] text-gray-400">Joined {formatDate(profile.created_at)}</p>
      )}
    </ActionForm>
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
    <article className="space-y-3 border border-[#E8E4DE] bg-white p-4">
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
    <div className="hidden overflow-x-auto border bg-white md:block">
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
  const staff = profiles.filter((p) => STAFF_ROLE_SET.has(p.role))
  // Business-portal and gift-portal users belong to a company; they are listed here read-only.
  const others = profiles.filter((p) => !CLIENT_ROLES.has(p.role) && !STAFF_ROLE_SET.has(p.role))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">Team Directory</h1>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1C1917]">Add team member</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Staff roles: admin · sales · operations · accounts · management · runner (deliveries only).
            Client logins are added from the company page.
          </p>
        </div>
        <AddMemberForm departmentOptions={departmentOptions} />
      </section>

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

      {others.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1C1917]">Portal accounts (not staff)</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">
              Business and gift portal users belong to a company and are managed there. Shown here for reference.
            </p>
          </div>
          <div className="overflow-x-auto border bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {others.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-3 font-medium">{p.full_name}</td>
                    <td className="p-3">{p.email}</td>
                    <td className="p-3">{OTHER_ROLE_LABELS[p.role] || p.role}</td>
                    <td className="p-3">{p.is_active === false ? 'Inactive' : 'Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
