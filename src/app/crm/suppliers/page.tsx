import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { PartnerDirectory } from '@/components/crm/partner-directory'

export default async function SuppliersPage() {
  const profile = await requireStaff(['admin', 'operations', 'management'])
  const supabase = await createClient()
  const { data: suppliers } = await supabase.from('suppliers').select('*').order('name', { ascending: true })

  return (
    <PartnerDirectory
      title="Suppliers"
      table="suppliers"
      rows={suppliers || []}
      canManage={['admin', 'operations'].includes(profile.role)}
    />
  )
}
