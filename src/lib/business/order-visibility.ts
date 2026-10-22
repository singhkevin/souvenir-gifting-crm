/**
 * Business portal orders include direct purchases. quotation_id may be null.
 * List rows are limited with company_id only; this check is the detail-page gate.
 */
export function businessOrderBelongsToCompany(
  order: { company_id?: string | null } | null | undefined,
  companyId: string | null | undefined,
): boolean {
  if (!order || !companyId) return false
  return order.company_id === companyId
}
