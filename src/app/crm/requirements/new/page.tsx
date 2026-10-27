import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { BackButton } from '@/components/ui/back-button'
import { NewRequirementForm } from './requirement-form'

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

      <NewRequirementForm
        companies={companies || []}
        contacts={contacts || []}
        owners={owners || []}
        role={profile.role}
        currentUserId={profile.id}
        preselectedCompanyId={preselectedCompanyId || ''}
      />
    </div>
  )
}
