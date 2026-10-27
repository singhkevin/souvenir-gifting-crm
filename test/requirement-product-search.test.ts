import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { ilikeContainsPattern, mergeProductHits, PRODUCT_SEARCH_LIMIT } from '../src/lib/requirements/product-search.ts'
import { applyCompanyDomainField } from '../src/lib/companies/quick-fields.ts'

const CATALOGUE_DUMP_CAP = 1000

test('the requirement picker dump stops at 1000 names, so a later SKU never appears', () => {
  const rows = Array.from({ length: CATALOGUE_DUMP_CAP + 5 }, (_, index) => ({
    id: `p-${index}`,
    name: `Item ${String(index).padStart(4, '0')}`,
    sku: `SKU-${index}`,
  }))
  rows.push({ id: 'late', name: 'Zzz Wool Notebook', sku: 'NB.01' })
  rows.sort((a, b) => a.name.localeCompare(b.name))

  const dumped = rows.slice(0, CATALOGUE_DUMP_CAP)
  assert.equal(dumped.some((row) => row.sku === 'NB.01'), false)

  const pattern = ilikeContainsPattern('NB.01')
  assert.equal(pattern, '%NB.01%')
  const found = rows.filter((row) => {
    const needle = 'nb.01'
    return row.sku.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle)
  })
  assert.deepEqual(found.map((row) => row.id), ['late'])
})

test('an unquoted or() filter splits a dotted SKU; a column ilike pattern keeps it', () => {
  const term = 'NB.01'
  const naive = `name.ilike.%${term}%,sku.ilike.%${term}%`
  const value = naive.slice(naive.indexOf('.ilike.') + '.ilike.'.length).split(',')[0]
  assert.match(value, /\./)
  assert.equal(ilikeContainsPattern(term), '%NB.01%')
  assert.equal(ilikeContainsPattern('100%_x'), '%100\\%\\_x%')
  assert.equal(ilikeContainsPattern(' a '), null)
  assert.equal(ilikeContainsPattern('  mug '), '%mug%')
})

test('merged search hits stay inside the render cap and ignore a null sku', () => {
  const nameHits = Array.from({ length: PRODUCT_SEARCH_LIMIT + 1 }, (_, index) => ({
    id: `n-${index}`,
    name: `Mug ${String(index).padStart(2, '0')}`,
    sku: null as string | null,
  }))
  const skuHits = [
    { id: 'n-0', name: 'Mug 00', sku: 'M-0' },
    { id: 'scarf', name: 'Scarf', sku: 'M-extra' },
  ]
  const merged = mergeProductHits(nameHits, skuHits, PRODUCT_SEARCH_LIMIT)
  assert.equal(merged.products.length, PRODUCT_SEARCH_LIMIT)
  assert.equal(merged.truncated, true)
  assert.equal(merged.products.filter((row) => row.id === 'n-0').length, 1)
  assert.equal(merged.products.some((row) => row.sku === null || row.id === 'scarf'), true)
})

test('requirement detail no longer embeds the catalogue, and adding a product does not redirect', () => {
  const page = readFileSync(new URL('../src/app/crm/requirements/[id]/page.tsx', import.meta.url), 'utf8')
  const picker = readFileSync(new URL('../src/app/crm/requirements/[id]/product-picker.tsx', import.meta.url), 'utf8')
  const actions = readFileSync(new URL('../src/app/crm/requirements/actions.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /from\('products'\)/)
  assert.match(page, /RequirementProductPicker/)
  assert.match(picker, /·/)
  assert.doesNotMatch(picker, /\/\//)
  for (const name of ['addProductToRequirement', 'removeProductFromRequirement', 'updateRequirementProductQty']) {
    const start = actions.indexOf(`export async function ${name}`)
    const next = actions.indexOf('export async function', start + 10)
    const body = actions.slice(start, next === -1 ? undefined : next)
    assert.doesNotMatch(body, /redirect\(/)
  }
  assert.match(actions, /\.limit\(limit \+ 1\)/)
  assert.match(actions, /ilike\(column, pattern\)/)
})

test('the new requirement form offers inline company and contact create', () => {
  const form = readFileSync(new URL('../src/app/crm/requirements/new/requirement-form.tsx', import.meta.url), 'utf8')
  assert.match(form, /\+ Add Company/)
  assert.match(form, /\+ Add Contact/)
  assert.match(form, /name="inline"/)
  assert.match(form, /name="domain"/)
  assert.doesNotMatch(form, /\/\//)
})

test('quick company domain becomes the website and the email allowlist', () => {
  const form = new FormData()
  form.set('domain', 'https://www.acme.com/about')
  assert.equal(applyCompanyDomainField(form), null)
  assert.equal(form.get('website'), 'https://acme.com')
  assert.equal(form.get('allowed_email_domains'), 'acme.com')

  const named = new FormData()
  named.set('domain', 'ACME.COM')
  named.set('website', 'https://existing.example')
  assert.equal(applyCompanyDomainField(named), null)
  assert.equal(named.get('website'), 'https://existing.example')
  assert.equal(named.get('allowed_email_domains'), 'acme.com')

  const blank = new FormData()
  assert.equal(applyCompanyDomainField(blank), null)

  const junk = new FormData()
  junk.set('domain', 'not a domain')
  assert.deepEqual(applyCompanyDomainField(junk), { error: 'Enter a domain like acme.com' })
})
