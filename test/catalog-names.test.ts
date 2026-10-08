import assert from 'node:assert/strict'
import test from 'node:test'
import { duplicateCatalogName } from '@/lib/catalogs/names'

test('duplicate name appends a single (copy)', () => {
  assert.equal(duplicateCatalogName('Diwali 2026'), 'Diwali 2026 (copy)')
})

test('copying a copy does not stack suffixes', () => {
  assert.equal(duplicateCatalogName('Diwali 2026 (copy)'), 'Diwali 2026 (copy)')
  assert.equal(duplicateCatalogName('Diwali 2026 copy'), 'Diwali 2026 (copy)')
  assert.equal(duplicateCatalogName('Diwali 2026 copy copy'), 'Diwali 2026 (copy)')
  assert.equal(duplicateCatalogName('Diwali 2026 (copy) (copy)'), 'Diwali 2026 (copy)')
})

test('a name that is only "copy" is kept', () => {
  assert.equal(duplicateCatalogName('Copy'), 'Copy (copy)')
})
