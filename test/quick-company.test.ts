import assert from 'node:assert/strict'
import test from 'node:test'
import { canEditCompanies, canEditContacts } from '../src/lib/roles.ts'
import {
  normalizeQuickCompanyCity,
  normalizeQuickCompanyDomains,
  normalizeQuickCompanyName,
} from '../src/lib/companies/quick-fields.ts'

test('quick company fields accept name, domain, and city', () => {
  assert.equal(normalizeQuickCompanyName('  Analytical Wizard  '), 'Analytical Wizard')
  assert.deepEqual(normalizeQuickCompanyName('   '), { error: 'Company name is required' })
  assert.deepEqual(normalizeQuickCompanyDomains(''), [])
  assert.deepEqual(normalizeQuickCompanyDomains('https://www.acme.com/about'), ['acme.com'])
  assert.deepEqual(normalizeQuickCompanyDomains('not a domain'), { error: 'Enter a domain like acme.com' })
  assert.equal(normalizeQuickCompanyCity('  Mumbai '), 'Mumbai')
  assert.equal(normalizeQuickCompanyCity('  '), null)
})

test('quick add uses the same company and contact roles as the full forms', () => {
  assert.equal(canEditCompanies('sales'), true)
  assert.equal(canEditCompanies('admin'), true)
  assert.equal(canEditCompanies('management'), false)
  assert.equal(canEditContacts('sales'), true)
  assert.equal(canEditContacts('management'), true)
  assert.equal(canEditContacts('operations'), false)
})
