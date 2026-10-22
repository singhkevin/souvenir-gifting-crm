import assert from 'node:assert/strict'
import test from 'node:test'
import {
  channelColumnsMissing,
  channelFlag,
  channelSummary,
  corporateLabel,
  hasChannelColumns,
  legacyChannelDefault,
  legacyVisibilityLabel,
  parseChannelCell,
  parseCorporateAccess,
  visibleOnChannel,
} from '../src/lib/products/channel-visibility.ts'
import { productVisibleInScope } from '../src/lib/catalogs/visibility.ts'

test('before the migration, store and business follow corporate "All companies"', () => {
  assert.equal(visibleOnChannel({ status: 'active', catalogue_access: 'all' }, 'store'), true)
  assert.equal(visibleOnChannel({ status: 'active', catalogue_access: 'selected' }, 'store'), false)
  assert.equal(visibleOnChannel({ status: 'active', catalogue_access: 'none' }, 'business'), false)
  assert.equal(legacyChannelDefault(null), true)
})

test('selected companies no longer hides a product from retail once the switch is on', () => {
  const product = { status: 'active', catalogue_access: 'selected', show_in_store: true, show_in_business: false }
  assert.equal(visibleOnChannel(product, 'store'), true)
  assert.equal(visibleOnChannel(product, 'business'), false)
  // Corporate is unchanged: only granted companies see it.
  assert.equal(productVisibleInScope(product, { kind: 'company', companyId: 'c' }, { granted: true, excluded: false }), true)
  assert.equal(productVisibleInScope(product, { kind: 'company', companyId: 'c' }, { granted: false, excluded: false }), false)
})

test('retail can be switched off while corporate stays on all companies', () => {
  const product = { status: 'active', catalogue_access: 'all', show_in_store: false, show_in_business: true }
  assert.equal(visibleOnChannel(product, 'store'), false)
  assert.equal(visibleOnChannel(product, 'business'), true)
  assert.equal(productVisibleInScope(product, { kind: 'company', companyId: 'c' }), true)
})

test('corporate none with retail on is retail-only', () => {
  const product = { status: 'active', catalogue_access: 'none', show_in_store: true, show_in_business: true }
  assert.equal(visibleOnChannel(product, 'store'), true)
  assert.equal(productVisibleInScope(product, { kind: 'company', companyId: 'c' }, { granted: true, excluded: false }), false)
})

test('inactive products are hidden on every channel', () => {
  for (const status of ['discontinued', 'draft', null]) {
    assert.equal(visibleOnChannel({ status, catalogue_access: 'all', show_in_store: true }, 'store'), false)
    assert.equal(visibleOnChannel({ status, catalogue_access: 'all', show_in_business: true }, 'business'), false)
  }
})

test('explicit false wins over the legacy rule; null falls back to it', () => {
  assert.equal(channelFlag({ catalogue_access: 'all', show_in_store: false }, 'store'), false)
  assert.equal(channelFlag({ catalogue_access: 'selected', show_in_store: null }, 'store'), false)
  assert.equal(channelFlag({ catalogue_access: 'all', show_in_business: null }, 'business'), true)
})

test('backfill rule keeps every channel identical on day one', () => {
  const rows = [
    { status: 'active', catalogue_access: 'all' },
    { status: 'active', catalogue_access: 'selected' },
    { status: 'active', catalogue_access: 'none' },
    { status: 'discontinued', catalogue_access: 'all' },
  ]
  for (const row of rows) {
    const backfilled = {
      ...row,
      show_in_store: legacyChannelDefault(row.catalogue_access),
      show_in_business: legacyChannelDefault(row.catalogue_access),
    }
    assert.equal(visibleOnChannel(backfilled, 'store'), visibleOnChannel(row, 'store'))
    assert.equal(visibleOnChannel(backfilled, 'business'), visibleOnChannel(row, 'business'))
  }
})

test('corporate access parsing and labels', () => {
  assert.equal(parseCorporateAccess('selected'), 'selected')
  assert.equal(parseCorporateAccess(' none '), 'none')
  assert.equal(parseCorporateAccess('public'), null)
  assert.equal(legacyVisibilityLabel('all'), 'catalogue')
  assert.equal(legacyVisibilityLabel('selected'), 'selected_companies')
  assert.equal(legacyVisibilityLabel('none'), 'internal_only')
  assert.equal(corporateLabel({ corporate: 'selected', companyCount: 1 }), '1 company')
  assert.equal(corporateLabel({ corporate: 'selected', companyCount: 3 }), '3 companies')
  assert.equal(corporateLabel({ corporate: 'none', companyCount: 0 }), 'None')
  assert.deepEqual(channelSummary({ catalogue_access: 'selected', show_in_store: true }, 2), {
    store: true,
    business: false,
    corporate: 'selected',
    companyCount: 2,
  })
})

test('CSV retail and business cells', () => {
  assert.deepEqual(parseChannelCell('', 'all'), { ok: true, value: true })
  assert.deepEqual(parseChannelCell('', 'selected'), { ok: true, value: false })
  assert.deepEqual(parseChannelCell('Yes', 'selected'), { ok: true, value: true })
  assert.deepEqual(parseChannelCell('no', 'all'), { ok: true, value: false })
  assert.deepEqual(parseChannelCell('maybe', 'all'), { ok: false })
})

test('schema detection for the channel columns', () => {
  assert.equal(channelColumnsMissing('column products.show_in_store does not exist'), true)
  assert.equal(channelColumnsMissing("Could not find the 'show_in_business' column"), true)
  assert.equal(channelColumnsMissing('duplicate key'), false)
  assert.equal(channelColumnsMissing(undefined), false)
  assert.equal(hasChannelColumns({ show_in_store: true, show_in_business: false }), true)
  assert.equal(hasChannelColumns({ catalogue_access: 'all' }), false)
})
