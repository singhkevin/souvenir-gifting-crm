const LEGAL_SUFFIXES = new Set([
  'limited',
  'ltd',
  'pvt',
  'pvtltd',
  'private',
  'inc',
  'incorporated',
  'llc',
  'llp',
  'co',
  'company',
  'corp',
  'corporation',
  'technologies',
  'technology',
  'tech',
  'systems',
  'solutions',
  'group',
  'india',
])

export function normalizeCompanyName(name: string) {
  const cleaned = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  if (!cleaned) return ''
  const parts = cleaned.split(' ').filter((part) => part && !LEGAL_SUFFIXES.has(part))
  return (parts.length ? parts : cleaned.split(' ')).join(' ')
}

export function normalizeDomain(website?: string | null) {
  if (!website) return null
  const raw = website.trim()
  if (!raw) return null
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
    const host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '')
    return host || null
  } catch {
    const host = raw
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      ?.replace(/:$/, '')
    return host || null
  }
}

export type CompanyLogoCandidate = {
  id: string
  name: string
  website?: string | null
  logo_path?: string | null
}

export function findReusableLogo(
  target: { id?: string; name: string; website?: string | null },
  candidates: CompanyLogoCandidate[],
) {
  const targetDomain = normalizeDomain(target.website)
  const targetName = normalizeCompanyName(target.name)
  const others = candidates.filter(
    (company) => company.id !== target.id && Boolean(company.logo_path?.trim()),
  )

  if (targetDomain) {
    const domainMatch = others.find((company) => normalizeDomain(company.website) === targetDomain)
    if (domainMatch?.logo_path) {
      return { company: domainMatch, reason: 'domain' as const }
    }
  }

  if (targetName.length >= 3) {
    const nameMatch = others.find((company) => normalizeCompanyName(company.name) === targetName)
    if (nameMatch?.logo_path) {
      return { company: nameMatch, reason: 'name' as const }
    }
  }

  return null
}
