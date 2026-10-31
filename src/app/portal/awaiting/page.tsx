import { redirect } from 'next/navigation'
import { settlePortalSignup } from '@/lib/portal/signup-server'
import { createClient } from '@/lib/supabase/server'
import { PORTAL_AWAITING } from '@/lib/portal/signup'

export const dynamic = 'force-dynamic'

export default async function PortalAwaitingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await settlePortalSignup(user.id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, portal_approval')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.portal_approval === 'approved') redirect('/portal/gifts')
  if (profile?.portal_approval === 'rejected') redirect('/login?error=portal')

  return (
    <section className="mx-auto max-w-lg py-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9E4300]">{PORTAL_AWAITING}</p>
      <h1 className="mt-2 font-[family-name:var(--font-newsreader)] text-3xl font-normal text-[#1C1B1A]">
        {profile?.full_name ? `${profile.full_name}, your account is waiting` : 'Your account is waiting'}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[#4A4640]">
        A company admin or the Souvenir team still has to approve this account. Gifts, prices, and ordering stay closed until then. You will get an email when the portal is open.
      </p>
    </section>
  )
}
