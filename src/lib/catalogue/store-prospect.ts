const PUBLIC_CATALOGUE_NOTE = 'public catalogue'

export type StoreCompanyMatch = {
  status?: string | null
  notes?: string | null
}

export type StoreContactMatch = {
  id: string
  company_id?: string | null
  company?: StoreCompanyMatch | StoreCompanyMatch[] | null
}

/** Guest checkout reuses a prospect created from the public catalogue. */
export function isPublicCatalogueProspect(company: StoreCompanyMatch | null | undefined): boolean {
  if (!company || company.status !== 'prospect') return false
  return (company.notes || '').toLowerCase().includes(PUBLIC_CATALOGUE_NOTE)
}

export function pickReusableStoreContact<T extends StoreContactMatch>(rows: T[]): T | null {
  for (const row of rows) {
    if (!row.company_id) continue
    const company = Array.isArray(row.company) ? row.company[0] : row.company
    if (isPublicCatalogueProspect(company)) return row
  }
  return null
}

/**
 * A named owner from org settings, when that profile is active.
 * Otherwise the first active admin, which is the previous store-order owner.
 */
export function resolveStoreOrderOwnerId(input: {
  configuredOwnerId?: string | null
  configuredOwnerActive?: boolean | null
  firstAdminId?: string | null
}): string | null {
  if (input.configuredOwnerId && input.configuredOwnerActive) return input.configuredOwnerId
  return input.firstAdminId ?? null
}
