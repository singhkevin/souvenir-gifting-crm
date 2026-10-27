export type SampleHolder = 'office' | 'team' | 'client' | 'supplier'

export type SampleCounts = {
  inOffice: number
  withTeam: number
  withClient: number
  pendingSupplier: number
}

const COUNT_KEY: Record<SampleHolder, keyof SampleCounts> = {
  office: 'inOffice',
  team: 'withTeam',
  client: 'withClient',
  supplier: 'pendingSupplier',
}

export function parseOptionalSampleQty(
  value: unknown,
): { ok: true; qty: number | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, qty: null }
  const raw = String(value).trim()
  if (!raw) return { ok: true, qty: null }
  const qty = Number(raw)
  if (!Number.isInteger(qty) || qty < 0 || qty > 1000000) {
    return { ok: false, error: 'Sample quantity must be a whole number from 0 to 1000000' }
  }
  return { ok: true, qty }
}

/**
 * First time a product is marked sample-only, or given an initial sample quantity,
 * it needs a sample_stock row. A later save does not add pieces again unless a
 * quantity was typed in.
 */
export function planInitialSampleStock(input: {
  sampleOnly: boolean
  initialQty: number | null
  stockQty: number
  existingInOffice: number | null
}): { action: 'skip' } | { action: 'ensure'; addQty: number } | { action: 'error'; error: string } {
  const typed = input.initialQty
  if (typed != null && (!Number.isInteger(typed) || typed < 0 || typed > 1000000)) {
    return { action: 'error', error: 'Sample quantity must be a whole number from 0 to 1000000' }
  }
  if (input.existingInOffice != null) {
    if (typed != null && typed > 0) return { action: 'ensure', addQty: typed }
    return { action: 'skip' }
  }
  if (input.sampleOnly) {
    const fromStock = Number.isInteger(input.stockQty) && input.stockQty > 0 ? input.stockQty : 0
    return { action: 'ensure', addQty: typed == null ? fromStock : typed }
  }
  if (typed != null && typed > 0) return { action: 'ensure', addQty: typed }
  return { action: 'skip' }
}

export type SampleTransferPlan = {
  ok: true
  stock: SampleCounts
  companyHeld: number | null
  teamHeld: number | null
}

/**
 * Move pieces between office, team, client, and supplier.
 * Client and team moves also change that holder's own balance so a return
 * can be checked against what that company or person still has.
 */
export function planSampleTransfer(input: {
  from: SampleHolder
  to: SampleHolder
  quantity: number
  stock: SampleCounts
  companyHeld: number | null
  teamHeld: number | null
}): SampleTransferPlan | { ok: false; error: string } {
  const { from, to, quantity, stock } = input
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'Enter a positive whole quantity.' }
  }
  if (from === to) return { ok: false, error: 'Choose a different destination.' }

  const source = stock[COUNT_KEY[from]]
  if (!Number.isInteger(source) || source < quantity) {
    return { ok: false, error: `Only ${Number.isInteger(source) ? source : 0} available.` }
  }
  if (from === 'client' || to === 'client') {
    if (input.companyHeld == null) return { ok: false, error: 'Select the client company.' }
  }
  if (from === 'team' || to === 'team') {
    if (input.teamHeld == null) return { ok: false, error: 'Select the team member.' }
  }
  if (from === 'client' && (input.companyHeld == null || input.companyHeld < quantity)) {
    const held = input.companyHeld ?? 0
    return { ok: false, error: held < 1 ? 'That client does not hold this sample.' : `That client holds ${held}.` }
  }
  if (from === 'team' && (input.teamHeld == null || input.teamHeld < quantity)) {
    const held = input.teamHeld ?? 0
    return { ok: false, error: held < 1 ? 'That team member does not hold this sample.' : `That team member holds ${held}.` }
  }

  const next: SampleCounts = { ...stock }
  next[COUNT_KEY[from]] = source - quantity
  next[COUNT_KEY[to]] = next[COUNT_KEY[to]] + quantity

  let companyHeld = input.companyHeld
  if (from === 'client' && companyHeld != null) companyHeld -= quantity
  if (to === 'client' && companyHeld != null) companyHeld += quantity
  let teamHeld = input.teamHeld
  if (from === 'team' && teamHeld != null) teamHeld -= quantity
  if (to === 'team' && teamHeld != null) teamHeld += quantity

  return { ok: true, stock: next, companyHeld, teamHeld }
}

/** Receive pieces a client is holding back into the office and square off their balance. */
export function planReceiveIntoOffice(input: {
  quantity: number
  clientHeld: number
  stock: SampleCounts
}): SampleTransferPlan | { ok: false; error: string } {
  return planSampleTransfer({
    from: 'client',
    to: 'office',
    quantity: input.quantity,
    stock: input.stock,
    companyHeld: input.clientHeld,
    teamHeld: null,
  })
}
