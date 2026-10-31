import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicSitePath } from '../src/lib/auth/tab.ts'
import { decideHostRoute, isGuestQuotePath } from '../src/lib/domain-routing.ts'
import { resolveHost } from '../src/lib/portal-host.ts'
import {
  absoluteClientQuoteUrl,
  customerQuoteCheckoutUrl,
  quoteViewToken,
  quoteViewTokenMatches,
} from '../src/lib/quotes/public-link.ts'

const QUOTE = '11111111-1111-4111-8111-111111111111'
const SECRET = 'test-quote-view-secret'

const LOCAL_ENV = {
  DOMAIN_SPLIT: '1',
  ROOT_DOMAIN: 'portal.localhost',
  PORTAL_ROOT_DOMAIN: 'portal.localhost',
  STORE_DOMAIN: 'store.localhost',
  ADMIN_HOST: 'admin.localhost',
  PORT: '3000',
  QUOTE_VIEW_SECRET: SECRET,
}

const PRODUCTION_ENV = {
  DOMAIN_SPLIT: '1',
  ROOT_DOMAIN: 'giftingstore.online',
  PORTAL_ROOT_DOMAIN: 'giftingstore.online',
  STORE_DOMAIN: 'souvenirgifting.com',
  ADMIN_HOST: 'admin.souvenirgifting.com',
  PORT: '3000',
  QUOTE_VIEW_SECRET: SECRET,
}

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {}
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key]
    if (patch[key] === undefined) delete process.env[key]
    else process.env[key] = patch[key]
  }
  try {
    fn()
  } finally {
    for (const key of Object.keys(prev)) {
      if (prev[key] === undefined) delete process.env[key]
      else process.env[key] = prev[key]
    }
  }
}

function hostOf(url: string) {
  return new URL(url).hostname
}

test('quotation links never use the admin host', () => {
  withEnv(LOCAL_ENV, () => {
    const adminOrigin = 'http://admin.localhost:3000'
    const portal = absoluteClientQuoteUrl({
      accountType: 'corporate',
      portalSlug: 'acme',
      quotationId: QUOTE,
      origin: adminOrigin,
    })
    const business = absoluteClientQuoteUrl({
      accountType: 'business',
      portalSlug: null,
      quotationId: QUOTE,
      origin: adminOrigin,
    })
    const direct = absoluteClientQuoteUrl({
      accountType: 'direct',
      portalSlug: null,
      quotationId: QUOTE,
      origin: adminOrigin,
    })
    const individual = absoluteClientQuoteUrl({
      accountType: 'direct',
      portalSlug: '',
      quotationId: QUOTE,
      origin: adminOrigin,
    })
    const noSlug = absoluteClientQuoteUrl({
      accountType: 'corporate',
      portalSlug: null,
      quotationId: QUOTE,
      origin: adminOrigin,
    })

    assert.equal(portal, `http://acme.portal.localhost:3000/portal/quotations/${QUOTE}`)
    assert.equal(business, `http://store.localhost:3000/business/quotes/${QUOTE}`)
    assert.equal(hostOf(direct), 'store.localhost')
    assert.equal(new URL(direct).pathname, `/quotes/${QUOTE}`)
    assert.equal(direct, individual)
    assert.equal(direct, noSlug)
    for (const url of [portal, business, direct, individual, noSlug]) {
      assert.notEqual(hostOf(url), 'admin.localhost')
      assert.equal(hostOf(url).startsWith('admin.'), false)
    }
    const token = new URL(direct).searchParams.get('t')
    assert.equal(token, quoteViewToken(QUOTE, SECRET))
    assert.equal(quoteViewTokenMatches(QUOTE, token, SECRET), true)
    assert.equal(quoteViewTokenMatches(QUOTE, 'wrong-token-value', SECRET), false)
  })
})

test('production quotation links use the portal or the store', () => {
  withEnv(PRODUCTION_ENV, () => {
    const portal = absoluteClientQuoteUrl({
      accountType: 'corporate',
      portalSlug: 'acme',
      quotationId: QUOTE,
      origin: 'https://admin.souvenirgifting.com',
    })
    const business = absoluteClientQuoteUrl({
      accountType: 'business',
      portalSlug: 'ignored',
      quotationId: QUOTE,
      origin: 'https://admin.souvenirgifting.com',
    })
    const direct = absoluteClientQuoteUrl({
      accountType: null,
      portalSlug: null,
      quotationId: QUOTE,
      origin: 'https://admin.giftingstore.online',
    })
    assert.equal(portal, `https://acme.giftingstore.online/portal/quotations/${QUOTE}`)
    assert.equal(business, `https://www.souvenirgifting.com/business/quotes/${QUOTE}`)
    assert.equal(hostOf(direct), 'www.souvenirgifting.com')
    assert.equal(new URL(direct).pathname, `/quotes/${QUOTE}`)
    assert.equal(hostOf(customerQuoteCheckoutUrl('tok')), 'www.souvenirgifting.com')
    assert.equal(customerQuoteCheckoutUrl('tok'), 'https://www.souvenirgifting.com/catalogue/checkout?quote=tok')
  })
})

test('without the domain split, a company with no slug stays on the single site portal', () => {
  withEnv({ ...LOCAL_ENV, DOMAIN_SPLIT: undefined, ROOT_DOMAIN: undefined, QUOTE_VIEW_SECRET: undefined }, () => {
    const url = absoluteClientQuoteUrl({
      accountType: 'corporate',
      portalSlug: null,
      quotationId: QUOTE,
      origin: 'http://admin.localhost:3000',
    })
    assert.equal(url, `http://localhost:3000/portal/quotations/${QUOTE}`)
    assert.notEqual(hostOf(url), 'admin.localhost')
  })
})

test('a public quotation link is empty until a view secret exists', () => {
  withEnv({ ...LOCAL_ENV, QUOTE_VIEW_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    assert.equal(absoluteClientQuoteUrl({
      accountType: 'direct',
      portalSlug: null,
      quotationId: QUOTE,
      origin: 'http://admin.localhost:3000',
    }), '')
  })
})

test('admin host rejects the portal quotation path and sends a guest quote to the store', () => {
  withEnv(LOCAL_ENV, () => {
    const admin = resolveHost('admin.localhost:3000')
    const store = resolveHost('store.localhost:3000')
    const tenant = resolveHost('acme.portal.localhost:3000')
    const portalRoot = resolveHost('portal.localhost:3000')
    assert.equal(admin.kind, 'admin')
    assert.equal(decideHostRoute(admin, `/portal/quotations/${QUOTE}`).action, 'not-found')
    const guest = decideHostRoute(admin, `/quotes/${QUOTE}`, '?t=abc')
    assert.equal(guest.action, 'redirect')
    if (guest.action === 'redirect') {
      assert.equal(guest.location, `http://store.localhost:3000/quotes/${QUOTE}?t=abc`)
    }
    assert.equal(decideHostRoute(store, `/quotes/${QUOTE}`, '?t=abc').action, 'continue')
    const fromTenant = decideHostRoute(tenant, `/quotes/${QUOTE}`, '?t=abc')
    assert.equal(fromTenant.action, 'redirect')
    if (fromTenant.action === 'redirect') {
      assert.equal(new URL(fromTenant.location).hostname, 'store.localhost')
    }
    const fromRoot = decideHostRoute(portalRoot, `/quotes/${QUOTE}`)
    assert.equal(fromRoot.action, 'redirect')
    if (fromRoot.action === 'redirect') {
      assert.equal(new URL(fromRoot.location).hostname, 'store.localhost')
    }
    assert.equal(isGuestQuotePath(`/quotes/${QUOTE}`), true)
    assert.equal(isGuestQuotePath('/quotes/not-a-uuid'), false)
    assert.equal(isGuestQuotePath(`/portal/quotations/${QUOTE}`), false)
    assert.equal(isPublicSitePath(`/quotes/${QUOTE}`), true)
    assert.equal(isPublicSitePath('/quotes/not-a-uuid'), false)
    assert.equal(isPublicSitePath(`/portal/quotations/${QUOTE}`), false)
  })
})
