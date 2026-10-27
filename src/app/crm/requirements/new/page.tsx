import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { BackButton } from '@/components/ui/back-button'
import { RequirementForm } from './requirement-form'

export default async function NewRequirementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; company_id?: string }>
}) {
  const profile = await requireStaff(['admin', 'sales', 'management'])
  const { error, company_id: preselectedCompanyId } = await searchParams
  const supabase = await createClient()

  const [{ data: companies }, { data: contacts }, { data: owners }] = await Promise.all([
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('contacts').select('id, full_name, company_id').order('full_name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'sales'])
      .eq('is_active', true)
      .order('full_name'),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton href="/crm/requirements" label="Back to requirements" />
      <h1 className="mb-6 mt-4 text-2xl font-bold text-[var(--color-primary)]">Add Requirement</h1>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <RequirementForm
        companies={(companies || []).map((company) => ({ id: company.id, name: company.name }))}
        contacts={(contacts || []).map((contact) => ({
          id: contact.id,
          full_name: contact.full_name,
          company_id: contact.company_id,
        }))}
        owners={
          profile.role === 'admin'
            ? (owners || []).map((owner) => ({ id: owner.id, full_name: owner.full_name }))
            : null
        }
        defaultOwnerId={profile.id}
        preselectedCompanyId={preselectedCompanyId || ''}
        canAddCompany={profile.role === 'admin' || profile.role === 'sales'}
        canAddContact
      />
    </div>
  )
}
