import { signOutToBusinessLogin } from '@/app/business/actions'
import type { BusinessAccess } from '@/lib/business/access-state'

/** Shop-account and blocked-email notices on the public business pages. */
export function BusinessAccessNotice({ access }: { access: BusinessAccess }) {
  if (access.state !== 'wrong_account' && access.state !== 'email_not_allowed') return null
  if (!access.banner) return null
  return (
    <div className="mb-6 border border-[#CCC5BD] bg-[#F6F3EC] px-4 py-3 text-sm text-[#9E4300]">
      <p>{access.banner}</p>
      {access.state === 'wrong_account' ? (
        <form action={signOutToBusinessLogin} className="mt-2">
          <button type="submit" className="text-xs font-semibold underline">
            Sign out
          </button>
        </form>
      ) : null}
    </div>
  )
}
