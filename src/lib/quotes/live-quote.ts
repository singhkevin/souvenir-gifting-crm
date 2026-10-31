export type LiveQuoteLine = {
  id: string
  quantity: number
  unitPrice: number
}

/** Values saved in the browser that a slower server refresh must not overwrite. */
export type LiveQuoteAhead = {
  prices: Record<string, number>
  quantities: Record<string, number>
  discountPercent: number | null
  taxPercent: number | null
}

export function emptyLiveAhead(): LiveQuoteAhead {
  return { prices: {}, quantities: {}, discountPercent: null, taxPercent: null }
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) < 0.001
}

/**
 * Apply a fresh server snapshot without dropping a save the server has not echoed yet.
 * When the server value catches up, that override is cleared.
 */
export function reconcileLiveQuote(
  server: { lines: LiveQuoteLine[]; discountPercent: number; taxPercent: number },
  ahead: LiveQuoteAhead,
): { lines: LiveQuoteLine[]; discountPercent: number; taxPercent: number; ahead: LiveQuoteAhead } {
  const nextAhead: LiveQuoteAhead = {
    prices: { ...ahead.prices },
    quantities: { ...ahead.quantities },
    discountPercent: ahead.discountPercent,
    taxPercent: ahead.taxPercent,
  }
  const lines = server.lines.map((line) => {
    let quantity = line.quantity
    let unitPrice = line.unitPrice
    if (nextAhead.quantities[line.id] != null) {
      if (sameNumber(nextAhead.quantities[line.id], line.quantity)) delete nextAhead.quantities[line.id]
      else quantity = nextAhead.quantities[line.id]
    }
    if (nextAhead.prices[line.id] != null) {
      if (sameNumber(nextAhead.prices[line.id], line.unitPrice)) delete nextAhead.prices[line.id]
      else unitPrice = nextAhead.prices[line.id]
    }
    return { id: line.id, quantity, unitPrice }
  })
  let discountPercent = server.discountPercent
  if (nextAhead.discountPercent != null) {
    if (sameNumber(nextAhead.discountPercent, server.discountPercent)) nextAhead.discountPercent = null
    else discountPercent = nextAhead.discountPercent
  }
  let taxPercent = server.taxPercent
  if (nextAhead.taxPercent != null) {
    if (sameNumber(nextAhead.taxPercent, server.taxPercent)) nextAhead.taxPercent = null
    else taxPercent = nextAhead.taxPercent
  }
  return { lines, discountPercent, taxPercent, ahead: nextAhead }
}
