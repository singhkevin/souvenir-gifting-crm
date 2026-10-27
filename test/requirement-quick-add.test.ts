import assert from 'node:assert/strict'
import test from 'node:test'
import { applyQuickCompanyFields, domainsFromQuickEntry } from '../src/lib/companies/quick-create.ts'

test('quick company fields require a name and map domain plus city', () => {
  const missing = new FormData()
  missing.set('name', '   ')
  assert.equal(applyQuickCompanyFields(missing).error, 'Company name is required')

  const form = new FormData()
  form.set('name', '  Acme Industries  ')
  form.set('domain', 'HTTPS://www.acme.com/about')
  form.set('city', '  Mumbai ')
  assert.equal(applyQuickCompanyFields(form).error, undefined)
  assert.equal(form.get('name'), 'Acme Industries')
  assert.equal(form.get('city'), 'Mumbai')
  assert.equal(form.get('allowed_email_domains'), 'acme.com')
  assert.equal(form.get('website'), 'HTTPS://www.acme.com/about')
})

test('a bare domain becomes the website and an invalid domain is rejected', () => {
  const form = new FormData()
  form.set('name', 'Acme')
  form.set('domain', 'Acme.co.in')
  assert.equal(applyQuickCompanyFields(form).error, undefined)
  assert.equal(form.get('allowed_email_domains'), 'acme.co.in')
  assert.equal(form.get('website'), 'https://acme.co.in')

  const bad = new FormData()
  bad.set('name', 'Acme')
  bad.set('domain', 'not a domain')
  assert.equal(applyQuickCompanyFields(bad).error, 'Enter a domain such as acme.com')
  assert.equal(bad.get('website'), null)
})

test('several domains are stored and an email is reduced to its host', () => {
  assert.deepEqual(domainsFromQuickEntry('buyer@acme.com, acme.co.in'), ['acme.com', 'acme.co.in'])
  const form = new FormData()
  form.set('name', 'Acme')
  form.set('domain', 'acme.com, acme.co.in')
  assert.equal(applyQuickCompanyFields(form).error, undefined)
  assert.equal(form.get('allowed_email_domains'), 'acme.com, acme.co.in')
  assert.equal(form.get('website'), null)
})
