import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { PartnerDirectory } from '@/components/crm/partner-directory'

export default async function PrintingVendorsPage() {
  const profile = await requireStaff(['admin', 'operations', 'management'])
  const supabase = await createClient()
  const { data: vendors } = await supabase.from('printing_vendors').select('*').order('name', { ascending: true })

  return (
    <PartnerDirectory
      title="Printing Vendors"
      table="printing_vendors"
      rows={vendors || []}
      canManage={['admin', 'operations'].includes(profile.role)}
    />
  )
}
