import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { accountKindForRole } from '../src/lib/account-kind.ts'
import { adminSiteUrl, publicSiteUrl, storeSiteUrl } from '../src/lib/brand.ts'
import { domainSplitEnabled } from '../src/lib/domain-flag.ts'
import {
  confirmOriginForAccount,
  decideHostRoute,
  businessPortalRedirect,
  finderDestinations,
  hostLoginDecision,
  pendingPortalRedirect,
  portalFindResult,
  PORTAL_FIND_MESSAGE,
  robotsHeaderFor,
  shareOriginForHost,
  staffAreaRedirect,
} from '../src/lib/domain-routing.ts'
import { landingPathForRole } from '../src/lib/safe-next.ts'
import {
  PORTAL_FIND_LIMIT,
  checkPortalFindRate,
  parsePortalFindInput,
  resetPortalFindLimiter,
} from '../src/lib/portal-find.ts'
import { resolveHost } from '../src/lib/portal-host.ts'

const SPLIT_ENV = {
  DOMAIN_SPLIT: '1',
  ROOT_DOMAIN: 'giftingstore.online',
  PORTAL_ROOT_DOMAIN: 'giftingstore.online',
  STORE_DOMAIN: 'souvenirgifting.com',
  ADMIN_HOST: 'admin.souvenirgifting.com',
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

test('DOMAIN_SPLIT defaults off and only accepts explicit on values', () => {
  withEnv({ DOMAIN_SPLIT: undefined }, () => {
    assert.equal(domainSplitEnabled(), false)
  })
  for (const value of ['', '0', 'false', 'off', 'no']) {
    withEnv({ DOMAIN_SPLIT: value }, () => {
      assert.equal(domainSplitEnabled(), false, value)
    })
  }
  for (const value of ['1', 'true', 'on', 'yes', ' TRUE ']) {
    withEnv({ DOMAIN_SPLIT: value }, () => {
      assert.equal(domainSplitEnabled(), true, value)
    })
  }
})

test('resolveHost is unchanged when the split is off, including new domain env', () => {
  withEnv({
    DOMAIN_SPLIT: undefined,
    ROOT_DOMAIN: 'giftingstore.online',
    PORTAL_ROOT_DOMAIN: 'portals.example',
    STORE_DOMAIN: 'souvenirgifting.com',
    ADMIN_HOST: 'admin.souvenirgifting.com',
  }, () => {
    assert.deepEqual(resolveHost('ACME.giftingstore.online:443'), { kind: 'tenant', slug: 'acme' })
    assert.deepEqual(resolveHost('www.giftingstore.online'), { kind: 'main' })
    assert.deepEqual(resolveHost('giftingstore.online'), { kind: 'main' })
    assert.deepEqual(resolveHost('www.acme.giftingstore.online'), { kind: 'main' })
    assert.deepEqual(resolveHost('admin.giftingstore.online'), { kind: 'tenant', slug: 'admin' })
    assert.deepEqual(resolveHost('shop.giftingstore.online'), { kind: 'tenant', slug: 'shop' })
    assert.deepEqual(resolveHost('localhost:3000'), { kind: 'main' })
    assert.deepEqual(resolveHost('127.0.0.1:3000'), { kind: 'main' })
    assert.deepEqual(resolveHost('preview.vercel.app'), { kind: 'main' })
    assert.deepEqual(resolveHost('souvenirgifting.com'), { kind: 'main' })
    assert.deepEqual(resolveHost('www.souvenirgifting.com'), { kind: 'main' })
    assert.deepEqual(resolveHost('admin.souvenirgifting.com'), { kind: 'main' })
    assert.deepEqual(resolveHost('acme.portals.example'), { kind: 'main' })
    assert.deepEqual(resolveHost(''), { kind: 'main' })
    assert.equal(decideHostRoute(resolveHost('giftingstore.online'), '/catalogue/123', '?budget=1').action, 'continue')
    assert.equal(decideHostRoute({ kind: 'store' }, '/crm/orders').action, 'continue')
    assert.equal(robotsHeaderFor({ kind: 'tenant', slug: 'acme' }, '/portal/catalogue'), null)
    assert.equal(landingPathForRole('business'), '/crm/dashboard')
    assert.equal(landingPathForRole('business_user'), '/business/dashboard')
    assert.equal(storeSiteUrl(), publicSiteUrl())
    assert.equal(adminSiteUrl(), publicSiteUrl())
    const pending = pendingPortalRedirect('giftingstore.online')
    assert.equal(pending.status, 307)
    assert.equal(pending.location, 'https://giftingstore.online/login')
    const businessOff = businessPortalRedirect('acme.giftingstore.online', '/business/register', '')
    assert.equal(businessOff.status, 307)
    assert.equal(businessOff.location, 'https://giftingstore.online/business/register')
    const staff = staffAreaRedirect('acme.giftingstore.online', '/crm/orders', '?tab=1')
    assert.equal(staff.status, 307)
    assert.equal(staff.location, 'https://giftingstore.online/crm/orders?tab=1')
  })
})

test('resolveHost matrix when the split is on', () => {
  withEnv(SPLIT_ENV, () => {
    assert.deepEqual(resolveHost('giftingstore.online'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('WWW.GiftingStore.Online:443'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('souvenirgifting.com'), { kind: 'store' })
    assert.deepEqual(resolveHost('www.souvenirgifting.com'), { kind: 'store' })
    assert.deepEqual(resolveHost('ADMIN.SouvenirGifting.COM'), { kind: 'admin' })
    assert.deepEqual(resolveHost('acme.giftingstore.online'), { kind: 'tenant', slug: 'acme' })
    assert.deepEqual(resolveHost('WWW.Acme.GiftingStore.Online:8443'), { kind: 'tenant', slug: 'acme' })
    assert.deepEqual(resolveHost('admin.giftingstore.online'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('shop.giftingstore.online'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('login.giftingstore.online'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('souvenirgifting.giftingstore.online'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('a.b.giftingstore.online'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('ab.giftingstore.online'), { kind: 'portal-root' })
    assert.deepEqual(resolveHost('localhost:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('app.localhost:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('127.0.0.1:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('[::1]:3000'), { kind: 'dev' })
    assert.deepEqual(resolveHost('my-branch.vercel.app'), { kind: 'dev' })
    assert.deepEqual(resolveHost('unknown.example'), { kind: 'dev' })
    assert.deepEqual(resolveHost(''), { kind: 'dev' })
    assert.deepEqual(resolveHost('Acme.GiftingStore.Online, other.example'), { kind: 'tenant', slug: 'acme' })
  })

  withEnv({
    ...SPLIT_ENV,
    PORTAL_ROOT_DOMAIN: undefined,
    STORE_DOMAIN: undefined,
    ADMIN_HOST: undefined,
  }, () => {
    assert.deepEqual(resolveHost('tcs.giftingstore.online'), { kind: 'tenant', slug: 'tcs' })
    assert.deepEqual(resolveHost('souvenirgifting.com'), { kind: 'store' })
    assert.deepEqual(resolveHost('admin.souvenirgifting.com'), { kind: 'admin' })
  })
})

test('middleware allowlists and path-preserving redirects, flag on and off', () => {
  withEnv({ DOMAIN_SPLIT: '0', ...SPLIT_ENV, DOMAIN_SPLIT: '0' }, () => {
    for (const path of ['/', '/catalogue/1', '/crm/orders', '/login', '/portal/catalogue']) {
      assert.equal(decideHostRoute({ kind: 'portal-root' }, path).action, 'continue')
      assert.equal(decideHostRoute({ kind: 'main' }, path).action, 'continue')
    }
  })

  withEnv(SPLIT_ENV, () => {
    const portal = resolveHost('giftingstore.online')
    const store = resolveHost('www.souvenirgifting.com')
    const admin = resolveHost('admin.souvenirgifting.com')
    const tenant = resolveHost('acme.giftingstore.online')

    assert.equal(decideHostRoute(portal, '/').action, 'continue')
    assert.equal(decideHostRoute(portal, '/api/portal-find').action, 'continue')
    assert.equal(decideHostRoute(portal, '/api/portal-ping').action, 'continue')
    assert.equal(decideHostRoute(portal, '/robots.txt').action, 'continue')
    assert.equal(decideHostRoute(portal, '/sitemap.xml').action, 'continue')
    assert.equal(decideHostRoute({ kind: 'store' }, '/robots.txt').action, 'continue')
    assert.equal(decideHostRoute({ kind: 'admin' }, '/sitemap.xml').action, 'continue')

    const catalogue = decideHostRoute(portal, '/catalogue/123', '?budget=1')
    assert.deepEqual(catalogue, {
      action: 'redirect',
      status: 301,
      location: 'https://souvenirgifting.com/catalogue/123?budget=1',
    })
    for (const path of ['/categories/drinkware', '/collections/diwali', '/about', '/request-quote', '/signup', '/business']) {
      const decision = decideHostRoute(portal, path, '')
      assert.equal(decision.action, 'redirect')
      if (decision.action === 'redirect') {
        assert.equal(decision.status, 301)
        assert.equal(decision.location, `https://souvenirgifting.com${path}`)
      }
    }

    const crm = decideHostRoute(portal, '/crm/orders', '?tab=open')
    assert.deepEqual(crm, {
      action: 'redirect',
      status: 301,
      location: 'https://admin.souvenirgifting.com/crm/orders?tab=open',
    })
    assert.equal((decideHostRoute(portal, '/dashboard') as { location: string }).location, 'https://admin.souvenirgifting.com/dashboard')
    assert.equal((decideHostRoute(portal, '/share/catalogs/abc') as { location: string }).location, 'https://admin.souvenirgifting.com/share/catalogs/abc')
    assert.equal((decideHostRoute(portal, '/orders/abc') as { location: string }).location, 'https://admin.souvenirgifting.com/orders/abc')

    const login = decideHostRoute(portal, '/login', '?next=/crm')
    assert.equal(login.action, 'redirect')
    if (login.action === 'redirect') {
      assert.equal(login.status, 302)
      assert.equal(login.location, 'https://giftingstore.online/?notice=login')
    }
    const portalPath = decideHostRoute(portal, '/portal/catalogue')
    assert.deepEqual(portalPath, { action: 'redirect', status: 302, location: 'https://giftingstore.online/' })
    assert.equal(decideHostRoute(portal, '/api/internal/portal-hosts/run').action, 'not-found')

    assert.equal(decideHostRoute(store, '/').action, 'continue')
    assert.equal(decideHostRoute(store, '/catalogue/1').action, 'continue')
    assert.equal(decideHostRoute(store, '/business/quote').action, 'continue')
    assert.equal(decideHostRoute(store, '/login').action, 'continue')
    assert.equal(decideHostRoute(store, '/forgot-password').action, 'continue')
    assert.equal(decideHostRoute(store, '/reset-password').action, 'continue')
    assert.equal(decideHostRoute(store, '/signup').action, 'continue')
    assert.equal(decideHostRoute(store, '/orders/SO-1001', '?t=token').action, 'continue')
    assert.equal(decideHostRoute(store, '/orders/abc').action, 'redirect')
    assert.equal(decideHostRoute(store, '/auth/confirm').action, 'continue')
    assert.deepEqual(decideHostRoute(store, '/crm/orders', '?x=1'), {
      action: 'redirect',
      status: 301,
      location: 'https://admin.souvenirgifting.com/crm/orders?x=1',
    })
    assert.equal(decideHostRoute(store, '/dashboard').action, 'redirect')
    assert.equal(decideHostRoute(store, '/share/catalogs/abc').action, 'redirect')
    assert.equal(decideHostRoute(store, '/present/example').action, 'continue')
    assert.equal(decideHostRoute(store, '/portal/catalogue').action, 'not-found')
    assert.equal(decideHostRoute(store, '/api/internal/portal-hosts/run').action, 'not-found')
    assert.equal(decideHostRoute(store, '/api/internal/quotes/expire').action, 'continue')

    assert.deepEqual(decideHostRoute(admin, '/'), {
      action: 'redirect',
      status: 302,
      location: 'https://admin.souvenirgifting.com/crm/dashboard',
    })
    assert.equal(decideHostRoute(admin, '/', '?code=abc').action, 'continue')
    assert.equal(decideHostRoute(admin, '/crm/orders').action, 'continue')
    assert.equal(decideHostRoute(admin, '/dashboard').action, 'continue')
    assert.equal(decideHostRoute(admin, '/share/catalogs/abc').action, 'continue')
    assert.equal(decideHostRoute(admin, '/orders/abc').action, 'continue')
    assert.equal(decideHostRoute(admin, '/login').action, 'continue')
    assert.equal(decideHostRoute(admin, '/api/internal/portal-hosts/run').action, 'continue')
    assert.deepEqual(decideHostRoute(admin, '/catalogue/9', '?q=pen'), {
      action: 'redirect',
      status: 301,
      location: 'https://souvenirgifting.com/catalogue/9?q=pen',
    })
    assert.deepEqual(decideHostRoute(admin, '/business', '?from=admin'), {
      action: 'redirect',
      status: 301,
      location: 'https://souvenirgifting.com/business?from=admin',
    })
    assert.equal(decideHostRoute(admin, '/portal/catalogue').action, 'not-found')

    assert.equal(decideHostRoute(tenant, '/login').action, 'continue')
    assert.equal(decideHostRoute(tenant, '/forgot-password').action, 'continue')
    assert.equal(decideHostRoute(tenant, '/reset-password').action, 'continue')
    assert.equal(decideHostRoute(tenant, '/auth/confirm').action, 'continue')
    assert.equal(decideHostRoute(tenant, '/portal/catalogue').action, 'continue')
    assert.equal(decideHostRoute(tenant, '/tenant/suspended').action, 'continue')
    assert.equal(decideHostRoute(tenant, '/catalogue/1').action, 'continue')
    assert.deepEqual(decideHostRoute(tenant, '/crm/orders', ''), {
      action: 'redirect',
      status: 301,
      location: 'https://admin.souvenirgifting.com/crm/orders',
    })
    assert.equal(decideHostRoute(tenant, '/api/internal/portal-hosts/run').action, 'not-found')
    assert.deepEqual(decideHostRoute(tenant, '/business/quote', '?x=1'), {
      action: 'redirect',
      status: 301,
      location: 'https://souvenirgifting.com/business/quote?x=1',
    })

    assert.equal(decideHostRoute(resolveHost('localhost:3000'), '/crm/orders').action, 'continue')
    assert.equal(decideHostRoute(resolveHost('preview.vercel.app'), '/catalogue').action, 'continue')

    assert.equal(robotsHeaderFor(portal, '/'), 'index, follow')
    assert.equal(robotsHeaderFor(portal, '/login'), 'noindex, nofollow')
    assert.equal(robotsHeaderFor(tenant, '/portal/catalogue'), 'noindex, nofollow')
    assert.equal(robotsHeaderFor(admin, '/crm/dashboard'), 'noindex, nofollow')
    assert.equal(robotsHeaderFor(store, '/catalogue'), null)

    const pending = pendingPortalRedirect('old.giftingstore.online')
    assert.equal(pending.location, 'https://giftingstore.online/')
    const links = finderDestinations()
    assert.deepEqual(Object.keys(links).sort(), ['adminLogin', 'business', 'finder', 'store'])
    assert.equal(links.store, 'https://souvenirgifting.com')
    assert.equal(links.business, 'https://souvenirgifting.com/business')
    assert.equal(links.adminLogin, 'https://admin.souvenirgifting.com/login')
  })
})

test('login role gate: staff, client, and retail stay on their own host', () => {
  const store = { kind: 'store' as const }
  const admin = { kind: 'admin' as const }
  const tenant = { kind: 'tenant' as const, slug: 'acme' }
  const dev = { kind: 'dev' as const }

  withEnv({ DOMAIN_SPLIT: undefined, ...SPLIT_ENV, DOMAIN_SPLIT: undefined }, () => {
    assert.deepEqual(hostLoginDecision({
      host: store,
      role: 'admin',
      companyId: null,
      tenantCompanyId: null,
      portalSlug: null,
    }), { allow: true })
  })

  withEnv(SPLIT_ENV, () => {
    assert.deepEqual(hostLoginDecision({
      host: admin, role: 'sales', companyId: null, tenantCompanyId: null, portalSlug: null,
    }), { allow: true })
    const staffOnStore = hostLoginDecision({
      host: store, role: 'admin', companyId: null, tenantCompanyId: null, portalSlug: null,
    })
    assert.equal(staffOnStore.allow, false)
    if (!staffOnStore.allow) {
      assert.match(staffOnStore.message, /admin/i)
      assert.equal(staffOnStore.href, 'https://admin.souvenirgifting.com/login')
    }

    const clientOnStore = hostLoginDecision({
      host: store, role: 'client_user', companyId: 'co', tenantCompanyId: null, portalSlug: 'acme',
    })
    assert.equal(clientOnStore.allow, false)
    if (!clientOnStore.allow) {
      assert.equal(clientOnStore.href, 'https://acme.giftingstore.online/login')
    }
    const clientOnAdmin = hostLoginDecision({
      host: admin, role: 'client_admin', companyId: 'co', tenantCompanyId: null, portalSlug: 'acme',
    })
    assert.equal(clientOnAdmin.allow, false)
    if (!clientOnAdmin.allow) assert.equal(clientOnAdmin.href, 'https://acme.giftingstore.online/login')

    assert.deepEqual(hostLoginDecision({
      host: tenant, role: 'client_user', companyId: 'co', tenantCompanyId: 'co', portalSlug: 'acme',
    }), { allow: true })
    const wrongTenant = hostLoginDecision({
      host: tenant, role: 'client_user', companyId: 'co', tenantCompanyId: 'other', portalSlug: 'acme',
    })
    assert.equal(wrongTenant.allow, false)

    assert.deepEqual(hostLoginDecision({
      host: store, role: 'retail', companyId: null, tenantCompanyId: null, portalSlug: null,
    }), { allow: true })
    assert.deepEqual(hostLoginDecision({
      host: store, role: 'business', companyId: null, tenantCompanyId: null, portalSlug: null,
    }), { allow: true })
    const retailOnAdmin = hostLoginDecision({
      host: admin, role: 'business_user', companyId: null, tenantCompanyId: null, portalSlug: null,
    })
    assert.equal(retailOnAdmin.allow, false)
    if (!retailOnAdmin.allow) assert.equal(retailOnAdmin.href, 'https://souvenirgifting.com/login')
    const retailOnTenant = hostLoginDecision({
      host: tenant, role: 'retail', companyId: null, tenantCompanyId: 'co', portalSlug: null,
    })
    assert.equal(retailOnTenant.allow, false)

    assert.deepEqual(hostLoginDecision({
      host: dev, role: 'admin', companyId: null, tenantCompanyId: null, portalSlug: null,
    }), { allow: true })
    assert.equal(landingPathForRole('retail'), '/')
    assert.equal(landingPathForRole('admin'), '/crm/dashboard')
    assert.equal(landingPathForRole('client_user'), '/portal/gifts')
    assert.equal(landingPathForRole('business_user'), '/business/dashboard')
    assert.equal(landingPathForRole('gift_employee'), '/gift')
    assert.equal(accountKindForRole('gift_employee'), 'client')
    assert.deepEqual(hostLoginDecision({
      host: tenant, role: 'gift_employee', companyId: 'co', tenantCompanyId: 'co', portalSlug: 'acme',
    }), { allow: true })
    const giftOnStore = hostLoginDecision({
      host: store, role: 'gift_employee', companyId: 'co', tenantCompanyId: null, portalSlug: 'acme',
    })
    assert.equal(giftOnStore.allow, false)
    assert.equal(accountKindForRole('management'), 'staff')
    assert.equal(accountKindForRole('business_admin'), 'retail')

    assert.equal(confirmOriginForAccount({
      role: 'admin', portalSlug: null, fallbackOrigin: 'https://giftingstore.online',
    }), 'https://admin.souvenirgifting.com')
    assert.equal(confirmOriginForAccount({
      role: 'client_user', portalSlug: 'acme', fallbackOrigin: 'https://giftingstore.online',
    }), 'https://acme.giftingstore.online')
    assert.equal(confirmOriginForAccount({
      role: 'retail', portalSlug: null, fallbackOrigin: 'https://giftingstore.online',
    }), 'https://souvenirgifting.com')
    assert.equal(shareOriginForHost({ kind: 'admin' }, 'https://localhost:3000'), 'https://admin.souvenirgifting.com')
    assert.equal(shareOriginForHost({ kind: 'dev' }, 'http://localhost:3000'), 'http://localhost:3000')
  })
})

test('portal finder is exact-match, uniform, and rate-limited', () => {
  withEnv(SPLIT_ENV, () => {
    assert.deepEqual(parsePortalFindInput('acme', 'giftingstore.online'), { kind: 'slug', slug: 'acme' })
    assert.deepEqual(parsePortalFindInput(' ACME ', 'giftingstore.online'), { kind: 'slug', slug: 'acme' })
    assert.deepEqual(parsePortalFindInput('https://acme.giftingstore.online/login', 'giftingstore.online'), { kind: 'slug', slug: 'acme' })
    assert.deepEqual(parsePortalFindInput('www.acme.giftingstore.online', 'giftingstore.online'), { kind: 'slug', slug: 'acme' })
    assert.equal(parsePortalFindInput('ac', 'giftingstore.online').kind, 'invalid')
    assert.equal(parsePortalFindInput('acme%', 'giftingstore.online').kind, 'invalid')
    assert.equal(parsePortalFindInput('admin', 'giftingstore.online').kind, 'invalid')
    assert.equal(parsePortalFindInput('person@acme.com', 'giftingstore.online').kind, 'email')
    assert.notEqual(parsePortalFindInput('acme-extra', 'giftingstore.online'), { kind: 'slug', slug: 'acme' })

    const found = portalFindResult('acme')
    const missing = portalFindResult(null)
    assert.equal(found.message, missing.message)
    assert.equal(found.message, PORTAL_FIND_MESSAGE)
    assert.equal(found.ok, true)
    assert.equal(missing.ok, true)
    assert.equal(missing.redirectTo, null)
    assert.equal(found.redirectTo, 'https://acme.giftingstore.online/login')
    assert.equal('name' in found, false)
    assert.equal('companies' in found, false)

    resetPortalFindLimiter()
    for (let i = 0; i < PORTAL_FIND_LIMIT; i += 1) {
      assert.equal(checkPortalFindRate('203.0.113.5', 1_000).ok, true)
    }
    const blocked = checkPortalFindRate('203.0.113.5', 1_000)
    assert.equal(blocked.ok, false)
    assert.equal(checkPortalFindRate('203.0.113.9', 1_000).ok, true)
    assert.equal(checkPortalFindRate('203.0.113.5', 1_000 + 60_000).ok, true)
    resetPortalFindLimiter()

    for (const file of [
      'src/components/site/portal-finder.tsx',
      'src/components/site/portal-finder-form.tsx',
    ]) {
      const source = fs.readFileSync(file, 'utf8')
      assert.equal(source.includes('from(\'companies\')'), false)
      assert.equal(source.includes('portal_slug'), false)
      assert.equal(source.toLowerCase().includes('infosys'), false)
      assert.equal(source.toLowerCase().includes('tcs'), false)
    }
  })
})
