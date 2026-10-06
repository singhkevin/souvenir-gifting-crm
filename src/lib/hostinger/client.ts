import 'server-only'

import { PRODUCTION_ROOT_DOMAIN } from '@/lib/brand'
import { portalDnsMode } from '@/lib/portal-hosts/mode'

const BASE = 'https://developers.hostinger.com'

export class HostingerRateLimited extends Error {
  retryAfterSeconds: number
  constructor(retryAfterSeconds: number) {
    super(`Hostinger rate limited; retry after ${retryAfterSeconds}s`)
    this.name = 'HostingerRateLimited'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class HostingerAuthError extends Error {
  constructor(message = 'Hostinger API authentication failed') {
    super(message)
    this.name = 'HostingerAuthError'
  }
}

export class HostingerValidationError extends Error {
  correlationId: string | null
  constructor(message: string, correlationId: string | null = null) {
    super(message)
    this.name = 'HostingerValidationError'
    this.correlationId = correlationId
  }
}

export class HostingerRetryableError extends Error {
  status: number
  correlationId: string | null
  constructor(status: number, message: string, correlationId: string | null = null) {
    super(message)
    this.name = 'HostingerRetryableError'
    this.status = status
    this.correlationId = correlationId
  }
}

export type ParkedDomain = {
  username?: string
  domain: string
  parent_domain?: string
  root_directory?: string
  type?: string
}

export type SubdomainEntry = {
  subdomain: string
  domain?: string
}

type RequestResult<T> = {
  data: T
  rateLimitRemaining: number | null
  rateLimitReset: number | null
}

function envConfig() {
  const token = (process.env.HOSTINGER_API_TOKEN || '').trim()
  const username = (process.env.HOSTINGER_ACCOUNT_USERNAME || '').trim()
  const websiteDomain = (process.env.HOSTINGER_WEBSITE_DOMAIN || process.env.ROOT_DOMAIN || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
  return { token, username, websiteDomain }
}

function isMockMode() {
  if (process.env.HOSTINGER_MOCK === '1') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('HOSTINGER_MOCK is not allowed when NODE_ENV=production')
    }
    return true
  }
  return false
}

function websitesBase(username: string, websiteDomain: string) {
  return `${BASE}/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(websiteDomain)}`
}

function parseRetryAfter(header: string | null): number {
  if (!header) return 60
  const asInt = Number.parseInt(header, 10)
  if (Number.isFinite(asInt) && asInt > 0) return asInt
  const when = Date.parse(header)
  if (Number.isFinite(when)) {
    return Math.max(1, Math.ceil((when - Date.now()) / 1000))
  }
  return 60
}

function correlationIdFromBody(body: unknown): string | null {
  if (body && typeof body === 'object' && 'correlation_id' in body) {
    const value = (body as { correlation_id?: unknown }).correlation_id
    return typeof value === 'string' ? value : null
  }
  return null
}

function errorMessageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const value = (body as { error?: unknown }).error
    if (typeof value === 'string' && value.trim()) return value
  }
  if (body && typeof body === 'object' && 'message' in body) {
    const value = (body as { message?: unknown }).message
    if (typeof value === 'string' && value.trim()) return value
  }
  return fallback
}

function normalizeParkedList(payload: unknown): ParkedDomain[] {
  if (Array.isArray(payload)) {
    return payload
      .map((row) => {
        if (!row || typeof row !== 'object') return null
        const domain = String((row as { domain?: string; parked_domain?: string }).domain
          || (row as { parked_domain?: string }).parked_domain
          || '').toLowerCase()
        if (!domain) return null
        return { ...(row as ParkedDomain), domain }
      })
      .filter(Boolean) as ParkedDomain[]
  }
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return normalizeParkedList((payload as { data: unknown }).data)
  }
  return []
}

function normalizeSubdomainList(payload: unknown): SubdomainEntry[] {
  if (Array.isArray(payload)) {
    return payload
      .map((row) => {
        if (typeof row === 'string') return { subdomain: row.toLowerCase() }
        if (!row || typeof row !== 'object') return null
        const subdomain = String(
          (row as { subdomain?: string; prefix?: string }).subdomain
          || (row as { prefix?: string }).prefix
          || '',
        ).toLowerCase()
        if (!subdomain) return null
        return { subdomain, domain: (row as { domain?: string }).domain }
      })
      .filter(Boolean) as SubdomainEntry[]
  }
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return normalizeSubdomainList((payload as { data: unknown }).data)
  }
  return []
}

/** In-memory mock for local/dev. Not used in production. */
const mockParked = new Set<string>()
const mockSubdomains = new Set<string>()
let mockCallCount = 0

async function mockRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<RequestResult<T>> {
  mockCallCount += 1
  await new Promise((r) => setTimeout(r, 40))
  if (process.env.HOSTINGER_MOCK_RATE_LIMIT === '1' && mockCallCount % 7 === 0) {
    throw new HostingerRateLimited(30)
  }

  const parkedMatch = path.match(/\/parked-domains(?:\/([^/?]+))?/)
  const subMatch = path.match(/\/subdomains(?:\/([^/?]+))?/)

  if (parkedMatch && method === 'GET' && !parkedMatch[1]) {
    return {
      data: [...mockParked].map((domain) => ({ domain })) as T,
      rateLimitRemaining: 80,
      rateLimitReset: null,
    }
  }
  if (parkedMatch && method === 'POST') {
    const hostname = String((body as { parked_domain?: string })?.parked_domain || '').toLowerCase()
    const prefix = hostname.split('.')[0]
    if (mockSubdomains.has(prefix)) {
      throw new HostingerValidationError('Domain exists as a subdomain', 'mock-subdomain-conflict')
    }
    mockParked.add(hostname)
    return {
      data: { message: 'Request accepted' } as T,
      rateLimitRemaining: 79,
      rateLimitReset: null,
    }
  }
  if (parkedMatch && method === 'DELETE' && parkedMatch[1]) {
    mockParked.delete(decodeURIComponent(parkedMatch[1]).toLowerCase())
    return {
      data: { message: 'Request accepted' } as T,
      rateLimitRemaining: 78,
      rateLimitReset: null,
    }
  }
  if (subMatch && method === 'GET' && !subMatch[1]) {
    return {
      data: [...mockSubdomains].map((subdomain) => ({ subdomain })) as T,
      rateLimitRemaining: 77,
      rateLimitReset: null,
    }
  }
  if (subMatch && method === 'DELETE' && subMatch[1]) {
    mockSubdomains.delete(decodeURIComponent(subMatch[1]).toLowerCase())
    return {
      data: { message: 'Request accepted' } as T,
      rateLimitRemaining: 76,
      rateLimitReset: null,
    }
  }

  throw new HostingerRetryableError(500, `Mock Hostinger: unhandled ${method} ${path}`)
}

/** Test helper: seed mock subdomain conflict. */
export function mockAddSubdomain(prefix: string) {
  mockSubdomains.add(prefix.toLowerCase())
}

export function mockReset() {
  mockParked.clear()
  mockSubdomains.clear()
  mockCallCount = 0
}

async function hostingerRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<RequestResult<T>> {
  if (portalDnsMode() === 'vercel') {
    throw new HostingerAuthError(
      'Hostinger parked-domain API is disabled. Company portals use the Vercel wildcard for ROOT_DOMAIN.',
    )
  }

  if (isMockMode()) return mockRequest<T>(method, path, body)

  if (
    process.env.NODE_ENV !== 'production'
    && process.env.HOSTINGER_MOCK !== '1'
    && process.env.HOSTINGER_ALLOW_LIVE !== '1'
  ) {
    throw new HostingerAuthError('Live Hostinger API disabled outside production')
  }

  const { token, username, websiteDomain } = envConfig()
  if (!token) throw new HostingerAuthError('HOSTINGER_API_TOKEN is not configured')
  if (!username) throw new HostingerAuthError('HOSTINGER_ACCOUNT_USERNAME is not configured')
  if (!websiteDomain) throw new HostingerAuthError('HOSTINGER_WEBSITE_DOMAIN is not configured')

  const url = path.startsWith('http') ? path : `${websitesBase(username, websiteDomain)}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const rateLimitRemaining = Number.parseInt(res.headers.get('RateLimit-Remaining') || res.headers.get('x-ratelimit-remaining') || '', 10)
    const rateLimitReset = Number.parseInt(res.headers.get('RateLimit-Reset') || res.headers.get('x-ratelimit-reset') || '', 10)
    const text = await res.text()
    let json: unknown = null
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = { message: text.slice(0, 200) }
      }
    }

    if (res.status === 429) {
      throw new HostingerRateLimited(parseRetryAfter(res.headers.get('Retry-After')))
    }
    if (res.status === 401 || res.status === 403) {
      throw new HostingerAuthError(errorMessageFromBody(json, 'Hostinger authentication failed'))
    }
    if (res.status === 422) {
      throw new HostingerValidationError(
        errorMessageFromBody(json, 'Hostinger validation error'),
        correlationIdFromBody(json),
      )
    }
    if (res.status >= 500) {
      throw new HostingerRetryableError(
        res.status,
        errorMessageFromBody(json, `Hostinger server error (${res.status})`),
        correlationIdFromBody(json),
      )
    }
    if (!res.ok) {
      throw new HostingerRetryableError(
        res.status,
        errorMessageFromBody(json, `Hostinger request failed (${res.status})`),
        correlationIdFromBody(json),
      )
    }

    return {
      data: json as T,
      rateLimitRemaining: Number.isFinite(rateLimitRemaining) ? rateLimitRemaining : null,
      rateLimitReset: Number.isFinite(rateLimitReset) ? rateLimitReset : null,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function listParked(): Promise<ParkedDomain[]> {
  const result = await hostingerRequest<unknown>('GET', '/parked-domains')
  return normalizeParkedList(result.data)
}

export async function park(hostname: string): Promise<{ accepted: boolean }> {
  await hostingerRequest<{ message?: string }>('POST', '/parked-domains', {
    parked_domain: hostname.toLowerCase(),
  })
  return { accepted: true }
}

export async function unpark(hostname: string): Promise<{ accepted: boolean }> {
  await hostingerRequest('DELETE', `/parked-domains/${encodeURIComponent(hostname.toLowerCase())}`)
  return { accepted: true }
}

export async function listSubdomains(): Promise<SubdomainEntry[]> {
  const result = await hostingerRequest<unknown>('GET', '/subdomains')
  return normalizeSubdomainList(result.data)
}

export async function deleteSubdomain(prefix: string): Promise<{ accepted: boolean }> {
  await hostingerRequest('DELETE', `/subdomains/${encodeURIComponent(prefix.toLowerCase())}`)
  return { accepted: true }
}

export function websiteDomainFromEnv(): string {
  return (process.env.HOSTINGER_WEBSITE_DOMAIN || process.env.ROOT_DOMAIN || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
}

export function hostnameForSlug(slug: string): string {
  const root = websiteDomainFromEnv() || PRODUCTION_ROOT_DOMAIN
  return `${slug.toLowerCase()}.${root}`
}
