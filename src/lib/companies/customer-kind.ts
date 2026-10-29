/**
 * Direct customers are company rows so requirements, quotations, orders,
 * invoices, and RLS keep using company_id. They are not microsite clients
 * and they are not /business accounts.
 *
 * account_type:
 *   corporate — microsite client (existing default)
 *   business  — open B2B account on /business
 *   direct    — staff-handled company or individual, no microsite
 *
 * An individual is a direct company named after the person, with one primary contact.
 */

export const CUSTOMER_KINDS = ['corporate', 'business', 'direct'] as const
export type CustomerKind = (typeof CUSTOMER_KINDS)[number]

export type CustomerKindChoice =
  | { accountType: 'corporate'; isIndividual: false }
  | { accountType: 'direct'; isIndividual: boolean }

export function isCustomerKind(value: string | null | undefined): value is CustomerKind {
  return value === 'corporate' || value === 'business' || value === 'direct'
}

export function isDirectAccount(accountType: string | null | undefined) {
  return accountType === 'direct'
}

/** Portal logins, invites, and microsite routing apply to corporate clients only. */
export function allowsPortalLogin(accountType: string | null | undefined) {
  return (accountType || 'corporate') === 'corporate'
}

/** Staff quotes for a direct customer use the same price surface as a microsite client. */
export function staffPricingPortal(accountType: string | null | undefined): 'business' | 'corporate' {
  return accountType === 'business' ? 'business' : 'corporate'
}

export function customerKindLabel(accountType: string | null | undefined, isIndividual?: boolean | null) {
  if (accountType === 'business') return 'Business'
  if (accountType === 'direct') return isIndividual ? 'Direct · Individual' : 'Direct'
  return 'Microsite client'
}

export function readCustomerKind(formData: FormData): CustomerKindChoice | { error: string } {
  const raw = String(formData.get('customer_kind') || 'corporate').trim()
  if (raw === '' || raw === 'corporate') {
    return { accountType: 'corporate', isIndividual: false }
  }
  if (raw !== 'direct') {
    return { error: 'Choose Corporate client (microsite) or Direct customer (no microsite).' }
  }
  const flag = String(formData.get('is_individual') || '').trim().toLowerCase()
  return {
    accountType: 'direct',
    isIndividual: flag === '1' || flag === 'on' || flag === 'true',
  }
}

/** Columns forced on a direct customer. Portal address and email domains stay empty. */
export function directCustomerColumns(isIndividual: boolean) {
  return {
    account_type: 'direct' as const,
    is_individual: isIndividual,
    portal_slug: null,
    allowed_email_domains: [] as string[],
  }
}

export function directCustomerDbError(message: string) {
  if (/is_individual|companies_direct_no_portal|companies_account_type_check|account_type/i.test(message)) {
    return 'Direct customers need the database update before they can be saved. Corporate clients can still be created.'
  }
  return null
}

/** Microsite lookup and the portal finder must not open a direct customer. */
export function tenantFromCompany(company: { id?: string | null; account_type?: string | null } | null) {
  if (!company?.id) return null
  if (isDirectAccount(company.account_type)) return null
  return company
}

export function requirementReturnPath(raw: FormDataEntryValue | null) {
  return String(raw || '') === '/crm/requirements/new' ? '/crm/requirements/new' : null
}
