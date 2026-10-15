import assert from 'node:assert/strict'
import test from 'node:test'
import {
  giftChoiceLocked,
  giftChoiceProblem,
  giftDomainListProblem,
  giftEmailProblem,
  giftWindowOpen,
  giftWindowProblem,
  normalizePhone,
  normalizePin,
  parseSizeOptions,
} from '../src/lib/gifts/rules.ts'
import { countGiftChoices, giftRowsToCsv, giftRowsToExcel } from '../src/lib/gifts/export.ts'

test('company domains are allowed and public mail is blocked', () => {
  assert.equal(giftEmailProblem('a@tkion.com', ['tkion.com']), null)
  assert.match(giftEmailProblem('a@gmail.com', ['gmail.com', 'tkion.com']) || '', /Gmail/i)
  assert.match(giftEmailProblem('a@yahoo.com', ['tkion.com']) || '', /public/i)
  assert.match(giftEmailProblem('a@other.com', ['tkion.com']) || '', /tkion.com/)
  assert.match(giftDomainListProblem([]) || '', /at least one/i)
  assert.match(giftDomainListProblem(['gmail.com']) || '', /public/i)
  assert.equal(giftDomainListProblem(['tkion.com']), null)
})

test('phone and PIN are exact digit lengths', () => {
  assert.equal(normalizePhone('98765 43210'), '9876543210')
  assert.equal(normalizePhone('987654321'), null)
  assert.equal(normalizePhone('+919876543210'), null)
  assert.equal(normalizePin('411 001'), '411001')
  assert.equal(normalizePin('41100'), null)
})

test('size is required only when the item has options', () => {
  const base = {
    name: 'Asha Rao',
    phone: '9876543210',
    address: '12 Lake Road',
    city: 'Pune',
    state: 'Maharashtra',
    pin: '411001',
    size: '',
    sizeOptions: [] as string[],
  }
  assert.equal(giftChoiceProblem(base), null)
  assert.match(giftChoiceProblem({ ...base, sizeOptions: ['S', 'M'] }) || '', /size/i)
  assert.equal(giftChoiceProblem({ ...base, size: 'M', sizeOptions: ['S', 'M'] }), null)
  assert.deepEqual(parseSizeOptions('S, M, L, s'), ['S', 'M', 'L'])
})

test('a submitted choice stays locked', () => {
  assert.equal(giftChoiceLocked(false), null)
  assert.match(giftChoiceLocked(true) || '', /locked/i)
})

test('open window rejects a close before the open', () => {
  assert.match(giftWindowProblem('2026-12-02T00:00:00Z', '2026-12-01T00:00:00Z') || '', /after/i)
  assert.equal(giftWindowOpen('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', Date.parse('2026-01-01T12:00:00Z')), true)
  assert.equal(giftWindowOpen('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', Date.parse('2026-02-01T00:00:00Z')), false)
})

test('csv and excel exports use the staff columns', () => {
  const rows = [{
    employeeName: 'Asha Rao',
    email: 'asha@tkion.com',
    selectedProduct: 'Team tee',
    variant: 'M',
    address: '12 Lake Road',
    city: 'Pune',
    state: 'Maharashtra',
    pin: '411001',
    phone: '9876543210',
  }]
  const csv = giftRowsToCsv(rows)
  assert.match(csv, /Employee Name,Email,Selected Product,Variant\/Size,Address,City,State,PIN,Phone/)
  assert.match(csv, /Asha Rao,asha@tkion.com,Team tee,M/)
  const excel = giftRowsToExcel([{ ...rows[0], employeeName: 'Asha <Rao>' }])
  assert.match(excel, /Asha &lt;Rao&gt;/)
  assert.match(excel, /Variant\/Size/)
  assert.deepEqual(countGiftChoices([
    { label: 'Team tee', size: 'M' },
    { label: 'Team tee', size: 'M' },
    { label: 'Bottle', size: null },
  ]), [
    { label: 'Team tee', size: 'M', count: 2 },
    { label: 'Bottle', size: '—', count: 1 },
  ])
})
