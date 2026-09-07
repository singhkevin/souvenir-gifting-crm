import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { PartnerDirectory } from '@/components/crm/partner-directory'

export default async function CourierPartnersPage() {
  const profile = await requireStaff(['admin', 'operations', 'management'])
  const supabase = await createClient()
  const { data: couriers } = await supabase.from('courier_partners').select('*').order('name', { ascending: true })

  return (
    <PartnerDirectory
      title="Courier Partners"
      table="courier_partners"
      rows={couriers || []}
      canManage={['admin', 'operations'].includes(profile.role)}
    />
  )
}
