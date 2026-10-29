import assert from 'node:assert/strict'
import test from 'node:test'
import { STORE_CART_KEY, type CartItem } from '../src/lib/catalogue/cart.ts'
import { BUSINESS_QUOTE_KEY } from '../src/lib/business/lines.ts'
import {
  BUSINESS_CATALOGUE_PATH,
  BUSINESS_QUOTE_PATH,
  businessProductPath,
  businessQuoteSignInPath,
  channelCataloguePath,
  channelProductPath,
  channelQuoteNavigation,
  storefrontMoqLine,
} from '../src/lib/business/portal-paths.ts'
import { businessQuoteLine, upsertBusinessQuoteLine } from '../src/lib/business/quote-cart.ts'
import { businessNavCategoryHref } from '../src/lib/catalogue/store-nav.ts'
import { isPublicSitePath } from '../src/lib/auth/tab.ts'

const pen = '11111111-1111-4111-8111-111111111111'
const mug = '22222222-2222-4222-8222-222222222222'

test('business quote actions stay under /business and retail quote stays on the store', () => {
  assert.equal(channelQuoteNavigation('business', pen), null)
  assert.equal(channelQuoteNavigation('retail', pen), `/request-quote?product=${pen}`)
  assert.equal(channelProductPath('business', pen), `/business/catalogue/${pen}`)
  assert.equal(channelProductPath('retail', pen), `/catalogue/${pen}`)
  assert.equal(channelCataloguePath('business'), BUSINESS_CATALOGUE_PATH)
  assert.equal(channelCataloguePath('retail'), '/catalogue')
  assert.equal(businessProductPath(mug), `${BUSINESS_CATALOGUE_PATH}/${mug}`)
  assert.equal(businessQuoteSignInPath(), `/login?next=${encodeURIComponent(BUSINESS_QUOTE_PATH)}`)
  assert.equal(BUSINESS_QUOTE_PATH, '/business/quote')
})

test('signed-out visitors can open the business catalogue and quote basket', () => {
  assert.equal(isPublicSitePath('/business'), true)
  assert.equal(isPublicSitePath('/business/catalogue'), true)
  assert.equal(isPublicSitePath(`/business/catalogue/${pen}`), true)
  assert.equal(isPublicSitePath('/business/quote'), true)
  assert.equal(isPublicSitePath('/business/register'), true)
  assert.equal(isPublicSitePath('/business/dashboard'), false)
  assert.equal(isPublicSitePath('/business/requests'), false)
  assert.equal(isPublicSitePath('/business/orders'), false)
  assert.equal(isPublicSitePath('/business/account'), false)
})

test('business category links stay on the business catalogue', () => {
  const categories = [{ id: 'cat-1', name: 'Drinkware' }]
  assert.equal(businessNavCategoryHref(categories, 'Drinkware'), '/business/catalogue?category=cat-1')
  assert.equal(businessNavCategoryHref(categories, 'Bottles'), '/business/catalogue?q=bottle')
})

test('MOQ is shown on the business portal and hidden on the retail store', () => {
  assert.equal(storefrontMoqLine('retail', 25), null)
  assert.equal(storefrontMoqLine('retail', 25, 'MOQ 25'), null)
  assert.equal(storefrontMoqLine('business', 25), 'MOQ 25')
  assert.equal(storefrontMoqLine('business', 25, 'MOQ 25 · indicative'), 'MOQ 25 · indicative')
})

test('quote basket lines replace the same product and leave the retail cart key alone', () => {
  assert.notEqual(BUSINESS_QUOTE_KEY, STORE_CART_KEY)
  const first = businessQuoteLine({
    id: pen,
    sku: 'PEN',
    name: 'Brass pen',
    price: null,
    quantity: 50,
    moq: 25,
    note: 'Engrave the team name',
  })
  const second = businessQuoteLine({
    id: mug,
    sku: 'MUG',
    name: 'Steel mug',
    price: 420,
    quantity: 10,
    moq: 10,
  })
  const replaced = businessQuoteLine({
    id: pen,
    sku: 'PEN',
    name: 'Brass pen',
    price: null,
    quantity: 80,
    moq: 25,
    note: 'x'.repeat(600),
  })
  const basket = upsertBusinessQuoteLine(upsertBusinessQuoteLine([first], second), replaced)
  assert.deepEqual(
    basket.map((line) => line.id),
    [mug, pen],
  )
  assert.equal(basket[1].quantity, 80)
  assert.equal(basket[1].note?.length, 500)
  assert.equal(basket[1].surface, 'business')
  assert.equal(basket[0].price, 420)
  assert.equal(first.price, null)
  const retail: CartItem[] = [
    {
      id: pen,
      sku: 'PEN',
      name: 'Brass pen',
      quantity: 1,
      maxQuantity: 1,
      surface: 'store',
    },
  ]
  assert.equal(retail[0].quantity, 1)
  assert.equal(retail[0].surface, 'store')
})
