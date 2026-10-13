import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isBusinessRole, isClientRole, isStaffRole } from "@/lib/roles"
import type { Role } from "@/lib/types"

export type ProfileSession = {
  id: string
  full_name: string | null
  email: string
  role: Role
  department_id: string | null
  company_id: string | null
  is_active: boolean
}

export async function getProfile(): Promise<ProfileSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department_id, company_id, is_active")
    .eq("id", user.id)
    .maybeSingle()
  return data as ProfileSession | null
}

export async function requireStaff(roles?: Role[]): Promise<ProfileSession> {
  const profile = await getProfile()
  if (!profile || !profile.is_active) redirect("/login")
  if (isBusinessRole(profile.role)) redirect("/business/dashboard")
  if (isClientRole(profile.role)) redirect("/portal/catalogue")
  if (!isStaffRole(profile.role)) redirect("/login")
  if (roles && !roles.includes(profile.role)) {
    redirect("/crm/access-denied")
  }
  return profile
}

export function canSeeFinance(role: Role) {
  return role === "admin" || role === "accounts" || role === "management"
}

export function canSeeCosts(role: Role) {
  return role === "admin" || role === "accounts" || role === "management"
}

export function canChangeOrderStage(role: Role) {
  return role === "admin" || role === "operations"
}

export function isOpsStaff(role: Role) {
  return role === "admin" || role === "operations"
}

/** Company-wide sales pipeline: admin and management only. */
export function seesAllSalesRecords(profile: ProfileSession) {
  return profile.role === "admin" || profile.role === "management"
}

type Scopeable<Q> = {
  eq: (column: string, value: string) => Q
  or: (filters: string) => Q
}

function scopeable<Q>(query: Q): Scopeable<Q> {
  return query as Scopeable<Q>
}

export function applyOwnerScope<Q>(query: Q, profile: ProfileSession, column = "owner_id"): Q {
  if (seesAllSalesRecords(profile)) return query
  return scopeable(query).eq(column, profile.id)
}

export function applyCompanyScope<Q>(query: Q, profile: ProfileSession): Q {
  if (
    profile.role === "admin" ||
    profile.role === "management" ||
    profile.role === "accounts" ||
    profile.role === "operations"
  ) {
    return query
  }
  return scopeable(query).eq("owner_id", profile.id)
}

export function applyOrderScope<Q>(query: Q, profile: ProfileSession): Q {
  if (profile.role === "admin" || profile.role === "management" || profile.role === "accounts") {
    return query
  }
  if (profile.role === "sales") {
    return scopeable(query).or(`owner_id.eq.${profile.id},assigned_to.eq.${profile.id}`)
  }
  if (profile.role === "operations") {
    const parts = [`assigned_to.eq.${profile.id}`, `operations_user_id.eq.${profile.id}`]
    if (profile.department_id) parts.push(`current_department_id.eq.${profile.department_id}`)
    return scopeable(query).or(parts.join(","))
  }
  return scopeable(query).eq("assigned_to", profile.id)
}
