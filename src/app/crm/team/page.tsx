import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TeamDirectory } from '@/components/crm/team-directory'

export default async function TeamPage() {
  await requireStaff(['admin'])
  const supabase = await createClient()
  const [{ data: profiles }, { data: departments }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('departments').select('id, name').order('name'),
  ])

  return <TeamDirectory profiles={profiles || []} departments={departments || []} />
}
