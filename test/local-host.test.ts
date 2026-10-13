import assert from 'node:assert/strict'
import test from 'node:test'
import { authCookieOptions, localCookieWriteOptions } from '../src/lib/auth/cookie-options.ts'
import { adminSiteUrl, portalRootSiteUrl, storeSiteUrl } from '../src/lib/brand.ts'
import {
  businessPortalRedirect,
  confirmOriginForAccount,
  decideHostRoute,
  finderDestinations,
  portalFindResult,
  staffAreaRedirect,
} from '../src/lib/domain-routing.ts'
import { originForHostname } from '../src/lib/local-origin.ts'
import { portalUrlForSlug, resolveHost, tenantPortalUrl } from '../src/lib/portal-host.ts'

const LOCAL_ENV = {
  DOMAIN_SPLIT: '1',
  ROOT_DOMAIN: 'portal.localhost',
  PORTAL_ROOT_DOMAIN: 'portal.localhost',
  STORE_DOMAIN: 'store.localhost',
  ADMIN_HOST: 'admin.localhost',
  PORT: '3000',
}

const PRODUCTION_ENV = {
  DOMAIN_SPLIT: '1',
  ROOT_DOMAIN: 'giftingstore.online',
  PORTAL_ROOT_DOMAIN: 'giftingstore.online',
  STORE_DOMAIN: 'souvenirgifting.com',
  ADMIN_HOST: 'admin.souvenirgifting.com',
  PORT: '3000',
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

test('production split still treats every loopback host as the dev surface', () => {
  withEnv(PRODUCTION_ENV, () => {
    assert.deepEqual(resolveHost('localhost:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('store.localhost:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('admin.localhost:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('acme.portal.localhost:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('127.0.0.1:3000'), { kind: 'dev' })
    assert.equal(storeSiteUrl(), 'https://souvenirgifting.com')
    assert.equal(adminSiteUrl(), 'https://admin.souvenirgifting.com')
    assert.equal(portalRootSiteUrl(), 'https://giftingstore.online')
    assert.equal(portalUrlForSlug('acme'), 'https://acme.giftingstore.online')
    assert.equal(originForHostname('souvenirgifting.com', '3000'), 'https://souvenirgifting.com')
  })
})

test('a partial local env does not turn loopback into the store', () => {
  withEnv({
    ...PRODUCTION_ENV,
    STORE_DOMAIN: 'store.localhost',
    ADMIN_HOST: 'admin.localhost',
  }, () => {
    assert.deepEqual(resolveHost('localhost:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('store.localhost:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('acme.giftingstore.online'), { kind: 'tenant', slug: 'acme' })
  })
})

test('local split maps localhost, admin, and company hosts', () => {
  withEnv(LOCAL_ENV, () => {
    assert.deepEqual(resolveHost('localhost:3000'), { kind: 'store' })
    assert.deepEqual(resolveHost('store.localhost:3000'), { kind: 'store' })
    assert.deepEqual(resolveHost('www.store.localhost'), { kind: 'store' })
    assert.deepEqual(resolveHost('127.0.0.1:3000'), { kind: 'store' })
    assert.deepEqual(resolveHost('[::1]:3000'), { kind: 'store' })
    assert.deepEqual(resolveHost('admin.localhost:3000'), { kind: 'admin' })
    assert.deepEqual(resolveHost('portal.localhost:3000'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('www.portal.localhost'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('acme.portal.localhost:3000'), { kind: 'tenant', slug: 'acme' })
    assert.deepEqual(resolveHost('WWW.Acme.Portal.Localhost:3000'), { kind: 'tenant', slug: 'acme' })
    assert.deepEqual(resolveHost('admin.portal.localhost'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('ab.portal.localhost'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('app.localhost:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('my-branch.vercel.app'), { kind: 'dev' })
    assert.deepEqual(resolveHost('souvenirgifting.com'), { kind: 'dev' })
    assert.deepEqual(resolveHost(''), { kind: 'dev' })

    assert.equal(decideHostRoute(resolveHost('localhost:3000'), '/business').action, 'continue')
    assert.equal(decideHostRoute(resolveHost('store.localhost:3000'), '/').action, 'continue')
    assert.equal(decideHostRoute(resolveHost('portal.localhost'), '/').action, 'continue')

    const catalogue = decideHostRoute(resolveHost('portal.localhost'), '/catalogue/1', '?q=pen')
    assert.deepEqual(catalogue, {
      action: 'redirect',
      status: 301,
      location: 'http://store.localhost:3000/catalogue/1?q=pen',
    })
    assert.deepEqual(decideHostRoute(resolveHost('localhost:3000'), '/crm/orders', '?tab=1'), {
      action: 'redirect',
      status: 301,
      location: 'http://admin.localhost:3000/crm/orders?tab=1',
    })
    assert.deepEqual(decideHostRoute(resolveHost('admin.localhost:3000'), '/'), {
      action: 'redirect',
      status: 302,
      location: 'http://admin.localhost:3000/crm/dashboard',
    })
    assert.deepEqual(decideHostRoute(resolveHost('acme.portal.localhost'), '/business/quote', ''), {
      action: 'redirect',
      status: 301,
      location: 'http://store.localhost:3000/business/quote',
    })

    const links = finderDestinations()
    assert.equal(links.store, 'http://store.localhost:3000')
    assert.equal(links.business, 'http://store.localhost:3000/business')
    assert.equal(links.adminLogin, 'http://admin.localhost:3000/login')
    assert.equal(links.finder, 'http://portal.localhost:3000/')

    assert.equal(confirmOriginForAccount({
      role: 'admin', portalSlug: null, fallbackOrigin: 'http://localhost:3000',
    }), 'http://admin.localhost:3000')
    assert.equal(confirmOriginForAccount({
      role: 'client_user', portalSlug: 'acme', fallbackOrigin: 'http://localhost:3000',
    }), 'http://acme.portal.localhost:3000')
    assert.equal(confirmOriginForAccount({
      role: 'retail', portalSlug: null, fallbackOrigin: 'http://localhost:3000',
    }), 'http://store.localhost:3000')
    assert.equal(portalFindResult('acme').redirectTo, 'http://acme.portal.localhost:3000/login')
    assert.equal(portalUrlForSlug('acme'), 'http://acme.portal.localhost:3000')
    assert.equal(tenantPortalUrl('acme', 'localhost:3000'), 'http://acme.portal.localhost:3000/portal/catalogue')
    assert.equal(storeSiteUrl(), 'http://store.localhost:3000')
    assert.equal(adminSiteUrl(), 'http://admin.localhost:3000')
    assert.equal(portalRootSiteUrl(), 'http://portal.localhost:3000')

    const staff = staffAreaRedirect('acme.portal.localhost:4000', '/crm/orders', '?tab=1')
    assert.equal(staff.location, 'http://admin.localhost:4000/crm/orders?tab=1')
    const business = businessPortalRedirect('acme.portal.localhost:4000', '/business', '')
    assert.equal(business.location, 'http://store.localhost:4000/business')
  })
})

test('local origins follow PORT when the request has no port', () => {
  withEnv({ ...LOCAL_ENV, PORT: '3001' }, () => {
    assert.equal(confirmOriginForAccount({
      role: 'sales', portalSlug: null, fallbackOrigin: 'http://localhost:3001',
    }), 'http://admin.localhost:3001')
    assert.equal(portalUrlForSlug('acme'), 'http://acme.portal.localhost:3001')
  })
})

test('split off keeps localhost on the main site even if local domains are set', () => {
  withEnv({ ...LOCAL_ENV, DOMAIN_SPLIT: undefined }, () => {
    assert.deepEqual(resolveHost('localhost:3000'), { kind: 'main' })
    assert.deepEqual(resolveHost('admin.localhost:3000'), { kind: 'main' })
    assert.deepEqual(resolveHost('acme.portal.localhost:3000'), { kind: 'tenant', slug: 'acme' })
    assert.equal(storeSiteUrl().startsWith('http://store.localhost'), false)
  })
})

test('auth cookies stay host-only and insecure on localhost', () => {
  const local = authCookieOptions('gf-auth-tab', 'admin.localhost:3000')
  assert.equal(local.name, 'gf-auth-tab')
  assert.equal(local.path, '/')
  assert.equal(local.sameSite, 'lax')
  assert.equal(local.secure, false)
  assert.equal('domain' in local, false)

  const nested = authCookieOptions('gf-auth-tab', 'acme.portal.localhost:3000')
  assert.equal(nested.secure, false)
  assert.equal('domain' in nested, false)

  const production = authCookieOptions('gf-auth-tab', 'admin.souvenirgifting.com')
  assert.equal(production.secure, undefined)
  assert.equal('domain' in production, false)

  const written = localCookieWriteOptions(
    { path: '/', domain: '.localhost', secure: true, sameSite: 'lax' as const },
    'acme.portal.localhost:3000',
  )
  assert.equal(written?.domain, undefined)
  assert.equal(written?.secure, false)
  assert.equal(written?.path, '/')

  const kept = localCookieWriteOptions(
    { path: '/', domain: '.giftingstore.online', secure: true },
    'admin.souvenirgifting.com',
  )
  assert.equal(kept?.domain, '.giftingstore.online')
  assert.equal(kept?.secure, true)
})
