import assert from 'node:assert/strict'
import test from 'node:test'
import { portalDnsMode } from '../src/lib/portal-hosts/mode.ts'
import { portalAddressHelp, resolveHost } from '../src/lib/portal-host.ts'

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

test('portal DNS is vercel on Vercel and in production even if Hostinger vars are set', () => {
  withEnv({
    VERCEL: '1',
    NODE_ENV: 'production',
    PORTAL_DNS: 'hostinger',
    HOSTINGER_MOCK: '1',
  }, () => {
    assert.equal(portalDnsMode(), 'vercel')
  })
  withEnv({
    VERCEL: undefined,
    NODE_ENV: 'production',
    PORTAL_DNS: 'hostinger',
    HOSTINGER_MOCK: undefined,
  }, () => {
    assert.equal(portalDnsMode(), 'vercel')
  })
})

test('local Hostinger mock stays available and the default local mode is vercel', () => {
  withEnv({
    VERCEL: undefined,
    NODE_ENV: 'development',
    PORTAL_DNS: undefined,
    HOSTINGER_MOCK: undefined,
  }, () => {
    assert.equal(portalDnsMode(), 'vercel')
  })
  withEnv({
    VERCEL: undefined,
    NODE_ENV: 'development',
    PORTAL_DNS: undefined,
    HOSTINGER_MOCK: '1',
  }, () => {
    assert.equal(portalDnsMode(), 'hostinger')
  })
  withEnv({
    VERCEL: undefined,
    NODE_ENV: 'test',
    PORTAL_DNS: 'hostinger',
    HOSTINGER_MOCK: undefined,
  }, () => {
    assert.equal(portalDnsMode(), 'hostinger')
  })
})

test('resolveHost sends company slugs to the tenant and keeps apex, www, localhost, and vercel.app on the main site', () => {
  withEnv({ ROOT_DOMAIN: 'giftingstore.online' }, () => {
    assert.deepEqual(resolveHost('acme.giftingstore.online'), { kind: 'tenant', slug: 'acme' })
    assert.deepEqual(resolveHost('www.giftingstore.online'), { kind: 'main' })
    assert.deepEqual(resolveHost('giftingstore.online'), { kind: 'main' })
    assert.deepEqual(resolveHost('localhost:3000'), { kind: 'main' })
    assert.deepEqual(resolveHost('giffter.vercel.app'), { kind: 'main' })
    assert.deepEqual(resolveHost('not-a-slug.example.com'), { kind: 'main' })
    assert.match(portalAddressHelp('acme'), /acme\.giftingstore\.online/)
    assert.match(portalAddressHelp('acme'), /Vercel wildcard/)
  })
  withEnv({ ROOT_DOMAIN: undefined }, () => {
    assert.deepEqual(resolveHost('acme.giftingstore.online'), { kind: 'main' })
  })
})
