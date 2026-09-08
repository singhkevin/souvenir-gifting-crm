import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getRequestTabId } from "@/lib/auth/tab-server"
import { TabSessionRevive } from "@/components/auth/tab-session-revive"
import { confirmSearchFromParams, hasRecoveryQuery } from "@/lib/auth/recovery"
import { SiteShell } from "@/components/site/site-shell"
import { PublicHome } from "@/components/site/public-home"
import type { Metadata } from "next"

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export const metadata: Metadata = {
  title: "GIFFTER — Corporate Gifting, Refined",
  description: "A premium corporate gifting catalogue for teams, clients and brands.",
}

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const type = firstParam(params.type) || ''
  const code = firstParam(params.code) || ''
  const tokenHash = firstParam(params.token_hash) || ''
  const query = new URLSearchParams()
  if (code) query.set('code', code)
  if (tokenHash) query.set('token_hash', tokenHash)
  if (type) query.set('type', type)

  if (hasRecoveryQuery(query)) {
    const dest = confirmSearchFromParams({ code, type, token_hash: tokenHash })
    redirect(`/auth/confirm?${dest}`)
  }

  if (!(await getRequestTabId())) return <TabSessionRevive />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.role === "client_admin" || profile?.role === "client_user") {
      redirect("/portal")
    }

    redirect("/crm/dashboard")
  }

  return (
    <SiteShell>
      <PublicHome />
    </SiteShell>
  )
}
