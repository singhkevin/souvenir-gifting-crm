import 'server-only'

import { createStoreBackorder, parseNeededBy } from '@/lib/catalogue/backorder'
import { prepareRetailCheckout, type CheckoutStockProduct } from '@/lib/catalogue/checkout-split'
import { placeStoreDirectOrder, type DirectOrderResult } from '@/lib/catalogue/direct-order'
import { normalizeCheckout, type CheckoutLineInput } from '@/lib/catalogue/purchase-path'
import { channelColumnsMissing, visibleOnChannel } from '@/lib/products/channel-visibility'
import { createAdminClient } from '@/lib/supabase/admin'

const STOCK_SELECT =
  'id, name, sku, stock_qty, fulfillment_mode, sample_only, price, status, show_in_store, catalogue_access'

type StockRow = {
  id: string
  name: string
  sku: string | null
  stock_qty: number | null
  fulfillment_mode: string | null
  sample_only?: boolean | null
  price: number | null
  status: string | null
  show_in_store?: boolean | null
  catalogue_access?: string | null
}

export type RetailCheckoutInput = {
  fullName?: string
  email?: string
  companyName?: string
  phone?: string
  fax?: string
  lines: CheckoutLineInput[]
  neededBy?: string
  note?: string
  notifyStock?: boolean
}

export type RetailCheckoutResult = DirectOrderResult & {
  arrangement?: boolean
  backorderId?: string
  backorderError?: string
}

function clean(value: string | undefined) {
  return String(value || '').trim()
}

async function loadStock(ids: string[]): Promise<{ error?: string; products?: CheckoutStockProduct[] }> {
  const admin = createAdminClient()
  if (!admin) return { error: 'Unable to place this order just now. Please try again shortly.' }

  let select = STOCK_SELECT
  let result = await admin.from('products').select(select).in('id', ids)
  if (result.error && /sample_only/i.test(result.error.message)) {
    select = select.replace(', sample_only', '')
    result = await admin.from('products').select(select).in('id', ids)
  }
  if (result.error && channelColumnsMissing(result.error.message)) {
    select = select.replace(', show_in_store', '')
    result = await admin.from('products').select(select).in('id', ids)
  }
  if (result.error) return { error: 'Unable to place this order. Please try again.' }

  const products = ((result.data || []) as unknown as StockRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    stockQty: row.stock_qty,
    fulfillmentMode: row.fulfillment_mode,
    sampleOnly: Boolean(row.sample_only),
    hasSellPrice: row.price != null && Number.isFinite(Number(row.price)),
    onStore: visibleOnChannel(
      {
        status: row.status,
        catalogue_access: row.catalogue_access,
        show_in_store: row.show_in_store,
      },
      'store',
    ),
    active: row.status === 'active',
  }))
  return { products }
}

/**
 * Paid checkout stays on placeStoreDirectOrder. Out-of-stock units are removed
 * from that call and saved as one arrangement request.
 */
export async function checkoutRetailCart(input: RetailCheckoutInput): Promise<RetailCheckoutResult> {
  if (clean(input.fax)) return { success: true }

  const needed = parseNeededBy(input.neededBy)
  if ('error' in needed) return { error: needed.error }

  const normalized = normalizeCheckout(input.lines.map((line) => ({ ...line, catalogId: null })))
  if ('error' in normalized) return { error: normalized.error }

  const loaded = await loadStock(normalized.lines.map((line) => line.productId))
  if (loaded.error || !loaded.products) return { error: loaded.error || 'Unable to place this order. Please try again.' }

  const prepared = prepareRetailCheckout(normalized.lines, loaded.products)
  if ('error' in prepared) return { error: prepared.error }

  let placed: DirectOrderResult = { success: true }
  if (prepared.inStock.length) {
    placed = await placeStoreDirectOrder({
      fullName: input.fullName,
      email: input.email,
      companyName: input.companyName,
      phone: input.phone,
      lines: prepared.inStock.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    })
    if (placed.error || !placed.success) return placed
  }

  if (!prepared.backorder.length) return placed

  const backorder = await createStoreBackorder({
    fullName: input.fullName,
    email: input.email,
    companyName: input.companyName,
    phone: input.phone,
    neededBy: input.neededBy,
    note: input.note,
    notifyStock: input.notifyStock,
    orderId: placed.orderId || null,
    lines: prepared.backorder.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      name: line.name,
      sku: line.sku,
    })),
  })

  if (backorder.error) {
    if (placed.orderId) {
      return { ...placed, success: true, arrangement: false, backorderError: backorder.error }
    }
    return { error: backorder.error }
  }

  return {
    ...placed,
    success: true,
    arrangement: true,
    backorderId: backorder.backorderId,
  }
}
