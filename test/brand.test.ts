import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_APP_NAME,
  DEFAULT_APP_SHORT_NAME,
  PRODUCTION_ROOT_DOMAIN,
  PRODUCTION_SITE_URL,
  appName,
  appShortName,
  brandWordmark,
  marketingHostLabel,
  marketingSiteUrl,
  publicSiteUrl,
} from '../src/lib/brand.ts'
import { defaultResendFrom } from '../src/lib/email/resend-config.ts'

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

const cleared = {
  NEXT_PUBLIC_APP_NAME: undefined,
  NEXT_PUBLIC_APP_SHORT_NAME: undefined,
  NEXT_PUBLIC_SITE_URL: undefined,
  NEXT_PUBLIC_MARKETING_URL: undefined,
}

test('brand defaults match Souvenir on giftingstore.online', () => {
  withEnv(cleared, () => {
    assert.equal(appName(), DEFAULT_APP_NAME)
    assert.equal(appName(), 'Souvenir - Gifting Solutions')
    assert.equal(appShortName(), DEFAULT_APP_SHORT_NAME)
    assert.equal(publicSiteUrl(), PRODUCTION_SITE_URL)
    assert.equal(publicSiteUrl(), 'https://www.giftingstore.online')
    assert.equal(PRODUCTION_ROOT_DOMAIN, 'giftingstore.online')
    assert.equal(marketingSiteUrl(), '')
    assert.equal(marketingHostLabel(), '')
    assert.deepEqual(brandWordmark(), { lead: 'Souvenir', rest: 'Gifting Solutions' })
    assert.equal(defaultResendFrom(), '"Souvenir - Gifting Solutions" <onboarding@resend.dev>')
  })
})

test('placeholder brand names and the old vercel host are ignored', () => {
  withEnv({
    ...cleared,
    NEXT_PUBLIC_APP_NAME: 'Gifting Solutions',
    NEXT_PUBLIC_APP_SHORT_NAME: 'Giffter',
    NEXT_PUBLIC_SITE_URL: 'https://souvenir-gifting-crm.vercel.app',
    NEXT_PUBLIC_MARKETING_URL: 'not a url',
  }, () => {
    assert.equal(appName(), DEFAULT_APP_NAME)
    assert.equal(appShortName(), DEFAULT_APP_SHORT_NAME)
    assert.equal(publicSiteUrl(), PRODUCTION_SITE_URL)
    assert.equal(marketingSiteUrl(), '')
  })
})

test('env overrides set the public name, site url, and marketing host', () => {
  withEnv({
    NEXT_PUBLIC_APP_NAME: ' Custom Name ',
    NEXT_PUBLIC_APP_SHORT_NAME: ' Custom ',
    NEXT_PUBLIC_SITE_URL: 'https://www.giftingstore.online/',
    NEXT_PUBLIC_MARKETING_URL: 'https://souvenirgifting.com/',
  }, () => {
    assert.equal(appName(), 'Custom Name')
    assert.equal(appShortName(), 'Custom')
    assert.equal(publicSiteUrl(), 'https://www.giftingstore.online')
    assert.equal(marketingSiteUrl(), 'https://souvenirgifting.com')
    assert.equal(marketingHostLabel(), 'souvenirgifting.com')
    assert.deepEqual(brandWordmark(), { lead: 'Custom Name', rest: null })
    assert.equal(defaultResendFrom(), '"Custom Name" <onboarding@resend.dev>')
  })
})
