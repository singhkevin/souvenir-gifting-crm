import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { businessOrderBelongsToCompany } from '../src/lib/business/order-visibility.ts'
import {
  isPublicCatalogueProspect,
  pickReusableStoreContact,
  resolveStoreOrderOwnerId,
} from '../src/lib/catalogue/store-prospect.ts'

test('business orders query includes direct orders for that company', () => {
  const list = readFileSync(new URL('../src/app/business/(portal)/orders/page.tsx', import.meta.url), 'utf8')
  const detail = readFileSync(new URL('../src/app/business/(portal)/orders/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(list, /\.eq\('company_id', companyId\)/)
  assert.equal(list.includes(".not('quotation_id'"), false)
  assert.equal(detail.includes('order.quotation_id'), false)

  const direct = { quotation_id: null, company_id: 'company-a' }
  const quoted = { quotation_id: 'quote-1', company_id: 'company-a' }
  const other = { quotation_id: null, company_id: 'company-b' }
  assert.equal(businessOrderBelongsToCompany(direct, 'company-a'), true)
  assert.equal(businessOrderBelongsToCompany(quoted, 'company-a'), true)
  assert.equal(businessOrderBelongsToCompany(other, 'company-a'), false)
  assert.equal(businessOrderBelongsToCompany(null, 'company-a'), false)
})

test('store checkout reuses only a public-catalogue prospect', () => {
  const prospect = {
    id: 'contact-1',
    company_id: 'company-1',
    company: { status: 'prospect', notes: 'Created from a public catalogue purchase.' },
  }
  const active = {
    id: 'contact-2',
    company_id: 'company-2',
    company: { status: 'active', notes: 'Created from a public catalogue purchase.' },
  }
  const otherNotes = {
    id: 'contact-3',
    company_id: 'company-3',
    company: { status: 'prospect', notes: 'Created from the website.' },
  }
  const embedded = {
    id: 'contact-4',
    company_id: 'company-4',
    company: [{ status: 'prospect', notes: 'PUBLIC CATALOGUE enquiry' }],
  }

  assert.equal(isPublicCatalogueProspect(prospect.company), true)
  assert.equal(isPublicCatalogueProspect(active.company), false)
  assert.equal(isPublicCatalogueProspect(otherNotes.company), false)
  assert.equal(pickReusableStoreContact([active, otherNotes, prospect])?.id, 'contact-1')
  assert.equal(pickReusableStoreContact([active, otherNotes]), null)
  assert.equal(pickReusableStoreContact([embedded])?.company_id, 'company-4')
  assert.equal(pickReusableStoreContact([{ id: 'loose', company_id: null, company: prospect.company }]), null)
})

test('store order owner prefers an active org setting, then the first admin', () => {
  assert.equal(
    resolveStoreOrderOwnerId({
      configuredOwnerId: 'sales-1',
      configuredOwnerActive: true,
      firstAdminId: 'admin-1',
    }),
    'sales-1',
  )
  assert.equal(
    resolveStoreOrderOwnerId({
      configuredOwnerId: 'sales-1',
      configuredOwnerActive: false,
      firstAdminId: 'admin-1',
    }),
    'admin-1',
  )
  assert.equal(
    resolveStoreOrderOwnerId({
      configuredOwnerId: null,
      firstAdminId: 'admin-1',
    }),
    'admin-1',
  )
  assert.equal(resolveStoreOrderOwnerId({}), null)
})
