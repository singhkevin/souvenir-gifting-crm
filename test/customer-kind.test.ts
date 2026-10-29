import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  allowsPortalLogin,
  customerKindLabel,
  directCustomerColumns,
  directCustomerDbError,
  isDirectAccount,
  readCustomerKind,
  requirementReturnPath,
  staffPricingPortal,
  tenantFromCompany,
} from '../src/lib/companies/customer-kind.ts'
import { shouldAttachNamedCompany } from '../src/lib/business/email-domain.ts'

function form(entries: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

test('customer kind labels use a middle dot and keep the three staff types', () => {
  assert.equal(customerKindLabel('corporate'), 'Microsite client')
  assert.equal(customerKindLabel(null), 'Microsite client')
  assert.equal(customerKindLabel('business'), 'Business')
  assert.equal(customerKindLabel('direct', false), 'Direct')
  assert.equal(customerKindLabel('direct', true), 'Direct · Individual')
  assert.equal(customerKindLabel('direct', true).includes('//'), false)
})

test('a direct customer is not a microsite and not a business portal account', () => {
  assert.equal(allowsPortalLogin('corporate'), true)
  assert.equal(allowsPortalLogin(null), true)
  assert.equal(allowsPortalLogin('business'), false)
  assert.equal(allowsPortalLogin('direct'), false)
  assert.equal(isDirectAccount('direct'), true)
  assert.equal(staffPricingPortal('direct'), 'corporate')
  assert.equal(staffPricingPortal('business'), 'business')
  assert.equal(staffPricingPortal('corporate'), 'corporate')
  assert.equal(tenantFromCompany({ id: 'co', account_type: 'direct' }), null)
  assert.deepEqual(tenantFromCompany({ id: 'co', account_type: 'corporate' })?.id, 'co')
  assert.equal(shouldAttachNamedCompany({ status: 'active', account_type: 'direct' }), false)
  assert.equal(shouldAttachNamedCompany({ status: 'prospect', account_type: 'direct' }), true)
})

test('creating a direct customer clears the portal address and can mark an individual', () => {
  assert.deepEqual(readCustomerKind(form({})), { accountType: 'corporate', isIndividual: false })
  assert.deepEqual(readCustomerKind(form({ customer_kind: 'corporate', is_individual: '1' })), {
    accountType: 'corporate',
    isIndividual: false,
  })
  assert.deepEqual(readCustomerKind(form({ customer_kind: 'direct' })), {
    accountType: 'direct',
    isIndividual: false,
  })
  assert.deepEqual(readCustomerKind(form({ customer_kind: 'direct', is_individual: '1' })), {
    accountType: 'direct',
    isIndividual: true,
  })
  assert.equal('error' in readCustomerKind(form({ customer_kind: 'store' })), true)
  assert.deepEqual(directCustomerColumns(true), {
    account_type: 'direct',
    is_individual: true,
    portal_slug: null,
    allowed_email_domains: [],
  })
  assert.match(directCustomerDbError('new row violates check constraint companies_account_type_check') || '', /database update/)
  assert.equal(directCustomerDbError('That portal address is already in use.'), null)
  assert.equal(requirementReturnPath('/crm/requirements/new'), '/crm/requirements/new')
  assert.equal(requirementReturnPath('https://evil.example/crm/requirements/new'), null)
})

test('staff create screens offer a microsite client or a direct customer', () => {
  const chooser = readFileSync(new URL('../src/app/crm/companies/customer-kind-fields.tsx', import.meta.url), 'utf8')
  const companyPage = readFileSync(new URL('../src/app/crm/companies/new/page.tsx', import.meta.url), 'utf8')
  const requirementPage = readFileSync(new URL('../src/app/crm/requirements/new/page.tsx', import.meta.url), 'utf8')
  assert.match(chooser, /Corporate client \(microsite\)/)
  assert.match(chooser, /Direct customer \(no microsite\)/)
  assert.match(chooser, /Individual/)
  assert.doesNotMatch(chooser, /\/\//)
  assert.match(companyPage, /CustomerKindChooser/)
  assert.match(requirementPage, /CustomerKindChooser/)
  assert.match(requirementPage, /name="return_to" value="\/crm\/requirements\/new"/)
})
