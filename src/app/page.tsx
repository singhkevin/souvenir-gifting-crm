import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getRequestTabId } from "@/lib/auth/tab-server"
import { TabSessionRevive } from "@/components/auth/tab-session-revive"

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
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

  if (type === 'recovery' || tokenHash || code) {
    const dest = new URLSearchParams()
    if (code) dest.set('code', code)
    if (tokenHash) dest.set('token_hash', tokenHash)
    if (type) dest.set('type', type)
    redirect(`/reset-password?${dest.toString()}`)
  }

  if (!(await getRequestTabId())) return <TabSessionRevive />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

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
