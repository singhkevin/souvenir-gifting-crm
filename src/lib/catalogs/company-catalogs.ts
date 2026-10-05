import type { SupabaseClient } from '@supabase/supabase-js'

export type CompanyCatalog = {
  id: string
  name: string
  employee_quantity: number | null
  budget_per_employee: number | null
  total_budget: number | null
  required_delivery_date: string | null
  status: string | null
  published_to_client_at: string | null
  created_at: string | null
}

const CATALOG_FIELDS =
  'id, name, employee_quantity, budget_per_employee, total_budget, required_delivery_date, status, published_to_client_at, created_at'

/**
 * Catalogs a company should see: legacy campaigns.company_id rows plus catalog_assignments.
 * If the assignment table is not migrated yet, the company_id list still loads.
 */
export async function listCompanyCatalogs(
  supabase: SupabaseClient,
  companyId: string | null,
): Promise<CompanyCatalog[]> {
  if (!companyId) return []

  const [{ data: direct }, assignedResult] = await Promise.all([
    supabase
      .from('campaigns')
      .select(CATALOG_FIELDS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('catalog_assignments')
      .select(`campaign:campaigns(${CATALOG_FIELDS})`)
      .eq('company_id', companyId),
  ])

  const byId = new Map<string, CompanyCatalog>()

  // Once assignments exist, they are the portal list. company_id stays a pricing pointer.
  if (!assignedResult.error) {
    for (const row of assignedResult.data || []) {
      const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign
      if (campaign?.id) byId.set(campaign.id, campaign as CompanyCatalog)
    }
  } else {
    for (const row of (direct || []) as CompanyCatalog[]) {
      if (row?.id) byId.set(row.id, row)
    }
  }

  return [...byId.values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}
