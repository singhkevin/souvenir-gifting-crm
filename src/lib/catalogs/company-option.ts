export type CompanyOption = {
  id: string
  name: string
  hint?: string | null
}

export function companyHint(row: {
  allowed_email_domains?: string[] | null
  portal_slug?: string | null
  gst_number?: string | null
}) {
  const domain = (row.allowed_email_domains || []).map((entry) => entry.trim()).find(Boolean)
  if (domain) return domain
  const slug = String(row.portal_slug || '').trim()
  if (slug) return slug
  const gst = String(row.gst_number || '').trim()
  return gst || null
}

export function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

export function companyListLabel(company: { name: string; hint?: string | null }) {
  return company.hint ? `${company.name} · ${company.hint}` : company.name
}
