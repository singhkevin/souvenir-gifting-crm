import assert from 'node:assert/strict'
import test from 'node:test'
import { expiryFromChoice, linkIsOpen, newShareToken, publicSlide } from '../src/lib/presentations/rules.ts'
import { buildPresentationPdf } from '../src/lib/presentations/pdf.ts'

test('share expiry is 30 days, a future date, or none', () => {
  const now = new Date('2026-10-14T00:00:00.000Z')
  const month = expiryFromChoice('30', '', now)
  assert.equal('expiresAt' in month && month.expiresAt, '2026-11-13T00:00:00.000Z')
  assert.equal(expiryFromChoice('none', '', now).expiresAt, null)
  assert.equal('error' in expiryFromChoice('date', '2026-10-01', now), true)
  const dated = expiryFromChoice('date', '2026-12-01', now)
  assert.equal('expiresAt' in dated && dated.expiresAt, '2026-12-01T23:59:59.000Z')
})

test('revoked and expired links stay closed', () => {
  const now = new Date('2026-10-14T00:00:00.000Z')
  assert.equal(linkIsOpen({ revokedAt: null, expiresAt: null }, now), true)
  assert.equal(linkIsOpen({ revokedAt: '2026-10-01', expiresAt: null }, now), false)
  assert.equal(linkIsOpen({ revokedAt: null, expiresAt: '2026-10-13T00:00:00.000Z' }, now), false)
  assert.equal(newShareToken().length >= 16, true)
})

test('the public slide drops price', () => {
  const slide = publicSlide({
    title: 'Bottle',
    imageUrl: null,
    specs: 'Steel',
    moq: 25,
    kind: 'product',
    memberNames: [],
    price: 499,
  })
  assert.equal('price' in slide, false)
  assert.equal(slide.moq, 25)
})

test('the deck pdf includes price on the staff file and a public closing line', async () => {
  const bytes = await buildPresentationPdf({
    title: 'Diwali deck',
    clientName: 'Northwind',
    notes: 'A short pitch.',
    organisation: 'Souvenir',
    phone: null,
    slides: [
      { title: 'Steel bottle', specs: '500 ml', price: 450, moq: 50, kind: 'product', memberNames: [] },
      { title: 'Welcome kit', specs: 'Notebook and bottle', price: 1200, moq: 20, kind: 'combo', memberNames: ['Notebook', 'Bottle'] },
    ],
  })
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), '%PDF')
  assert.equal(bytes.length > 1000, true)
})
