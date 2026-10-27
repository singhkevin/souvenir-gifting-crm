/** Pure sample-ledger rules. Stock totals stay on sample_stock. Who holds a piece lives on sample_holdings. */

export const SAMPLE_VIEW_ROLES = ['admin', 'sales', 'operations', 'accounts', 'management'] as const
export const SAMPLE_MANAGE_ROLES = ['admin', 'sales', 'operations'] as const

const TEXT_MAX = 500
const QTY_MAX = 1_000_000

export type SampleCounts = {
  in_office: number
  with_team: number
  with_client: number
  pending_supplier: number
}

export type SampleMovementDraft = {
  product_id: string
  quantity: number
  from_holder: 'office' | 'team' | 'client' | 'supplier'
  to_holder: 'office' | 'team' | 'client' | 'supplier'
  company_id: string | null
  holder_profile_id: string | null
  condition: string | null
  note: string | null
}

export function canManageSamples(role: string | null | undefined) {
  return (SAMPLE_MANAGE_ROLES as readonly string[]).includes(role || '')
}

export function cleanSampleText(value: unknown, label = 'Notes'): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return { ok: true, value: null }
  if (text.length > TEXT_MAX) return { ok: false, error: `${label} must be ${TEXT_MAX} characters or fewer.` }
  return { ok: true, value: text }
}

/** Positive whole quantity for a send or a return. */
export function parseSampleQty(value: unknown): { ok: true; value: number } | { ok: false; error: string } {
  const raw = String(value ?? '').trim()
  if (!/^[1-9]\d*$/.test(raw)) return { ok: false, error: 'Enter a positive whole quantity.' }
  const quantity = Number(raw)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > QTY_MAX) {
    return { ok: false, error: 'Enter a positive whole quantity.' }
  }
  return { ok: true, value: quantity }
}

/** Blank means "not entered". Zero is allowed on the product form. */
export function parseOpeningQty(value: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = String(value ?? '').trim()
  if (!raw) return { ok: true, value: null }
  if (!/^\d+$/.test(raw)) return { ok: false, error: 'Sample quantity must be a whole number from 0 to 1000000.' }
  const quantity = Number(raw)
  if (quantity > QTY_MAX) return { ok: false, error: 'Sample quantity must be a whole number from 0 to 1000000.' }
  return { ok: true, value: quantity }
}

/**
 * Pieces to add to in-office stock when a product is saved.
 * sample_only with no stock row and no quantity records 1, so the product shows on Samples.
 * An explicit quantity always wins. Saving again without a quantity does not add more.
 */
export function planOpeningSample(input: {
  sampleOnly: boolean
  sampleQtyRaw: unknown
  stockExists: boolean
}): { ok: true; add: number; ensureRow: boolean } | { ok: false; error: string } {
  const parsed = parseOpeningQty(input.sampleQtyRaw)
  if (!parsed.ok) return parsed
  if (parsed.value != null && parsed.value > 0) return { ok: true, add: parsed.value, ensureRow: true }
  if (input.sampleOnly && !input.stockExists) {
    return { ok: true, add: parsed.value === 0 ? 0 : 1, ensureRow: true }
  }
  return { ok: true, add: 0, ensureRow: false }
}

export function netHolderQuantity(
  rows: { quantity: unknown; from_holder: string | null; to_holder: string | null }[],
  holder: 'client' | 'team',
) {
  return rows.reduce((sum, row) => {
    const quantity = Number(row.quantity) || 0
    if (row.to_holder === holder) return sum + quantity
    if (row.from_holder === holder) return sum - quantity
    return sum
  }, 0)
}

export function planReceiveIntoOffice(input: {
  productId: string
  companyId: string
  quantity: unknown
  condition: unknown
  note: unknown
  stock: SampleCounts
  clientHolding: number
}):
  | {
      ok: true
      inOffice: number
      withClient: number
      clientHolding: number
      squaredOff: boolean
      movement: SampleMovementDraft
    }
  | { ok: false; error: string } {
  const productId = input.productId.trim()
  const companyId = input.companyId.trim()
  if (!productId) return { ok: false, error: 'Select a product.' }
  if (!companyId) return { ok: false, error: 'Select the client who is returning the sample.' }
  const quantity = parseSampleQty(input.quantity)
  if (!quantity.ok) return quantity
  const held = Math.max(0, Math.floor(Number(input.clientHolding) || 0))
  if (quantity.value > held) return { ok: false, error: `This client holds ${held}.` }
  const withClient = Math.max(0, Math.floor(Number(input.stock.with_client) || 0))
  if (quantity.value > withClient) return { ok: false, error: `Only ${withClient} are with clients.` }
  const condition = cleanSampleText(input.condition, 'Condition')
  if (!condition.ok) return condition
  const note = cleanSampleText(input.note, 'Return notes')
  if (!note.ok) return note
  const clientHolding = held - quantity.value
  return {
    ok: true,
    inOffice: Math.max(0, Math.floor(Number(input.stock.in_office) || 0)) + quantity.value,
    withClient: withClient - quantity.value,
    clientHolding,
    squaredOff: clientHolding === 0,
    movement: {
      product_id: productId,
      quantity: quantity.value,
      from_holder: 'client',
      to_holder: 'office',
      company_id: companyId,
      holder_profile_id: null,
      condition: condition.value,
      note: note.value,
    },
  }
}

export function planSendSample(input: {
  productId: string
  destination: string
  companyId: string
  profileId: string
  from: string
  fromProfileId: string
  quantity: unknown
  note: unknown
  stock: SampleCounts
  clientHolding: number
  teamHolding: number
  sourceTeamHolding: number
}):
  | {
      ok: true
      stock: SampleCounts
      clientHolding: number | null
      teamHolding: number | null
      sourceTeamHolding: number | null
      movement: SampleMovementDraft
    }
  | { ok: false; error: string } {
  const productId = input.productId.trim()
  if (!productId) return { ok: false, error: 'Select a product.' }
  const destination = input.destination === 'team' ? 'team' : input.destination === 'client' ? 'client' : ''
  if (!destination) return { ok: false, error: 'Choose a client company or a team member.' }
  const from = input.from === 'team' ? 'team' : 'office'
  if (destination === 'team' && from === 'team') {
    return { ok: false, error: 'Receive a team sample into the office before sending it to someone else.' }
  }
  const quantity = parseSampleQty(input.quantity)
  if (!quantity.ok) return quantity
  const note = cleanSampleText(input.note, 'Notes')
  if (!note.ok) return note

  const companyId = input.companyId.trim()
  const profileId = input.profileId.trim()
  const fromProfileId = input.fromProfileId.trim()
  if (destination === 'client' && !companyId) return { ok: false, error: 'Select the client receiving the sample.' }
  if (destination === 'team' && !profileId) return { ok: false, error: 'Select the team member receiving the sample.' }
  if (from === 'team' && !fromProfileId) return { ok: false, error: 'Select the team member the sample is leaving.' }

  const stock: SampleCounts = {
    in_office: Math.max(0, Math.floor(Number(input.stock.in_office) || 0)),
    with_team: Math.max(0, Math.floor(Number(input.stock.with_team) || 0)),
    with_client: Math.max(0, Math.floor(Number(input.stock.with_client) || 0)),
    pending_supplier: Math.max(0, Math.floor(Number(input.stock.pending_supplier) || 0)),
  }

  let sourceTeamHolding: number | null = null
  if (from === 'office') {
    if (quantity.value > stock.in_office) return { ok: false, error: `Only ${stock.in_office} are in the office.` }
    stock.in_office -= quantity.value
  } else {
    const available = Math.max(0, Math.floor(Number(input.sourceTeamHolding) || 0))
    if (quantity.value > available) return { ok: false, error: `This team member holds ${available}.` }
    if (quantity.value > stock.with_team) return { ok: false, error: `Only ${stock.with_team} are with the team.` }
    sourceTeamHolding = available - quantity.value
    stock.with_team -= quantity.value
  }

  let clientHolding: number | null = null
  let teamHolding: number | null = null
  if (destination === 'client') {
    clientHolding = Math.max(0, Math.floor(Number(input.clientHolding) || 0)) + quantity.value
    stock.with_client += quantity.value
  } else {
    teamHolding = Math.max(0, Math.floor(Number(input.teamHolding) || 0)) + quantity.value
    stock.with_team += quantity.value
  }

  return {
    ok: true,
    stock,
    clientHolding,
    teamHolding,
    sourceTeamHolding,
    movement: {
      product_id: productId,
      quantity: quantity.value,
      from_holder: from,
      to_holder: destination,
      company_id: destination === 'client' ? companyId : null,
      holder_profile_id: destination === 'team' ? profileId : from === 'team' ? fromProfileId : null,
      condition: null,
      note: note.value,
    },
  }
}

export type SampleSearchable = {
  name: string
  sku: string
  holders: string[]
}

export function filterSamples<T extends SampleSearchable>(rows: T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return rows
  return rows.filter((row) => [row.name, row.sku, ...row.holders].join('\n').toLowerCase().includes(needle))
}

export function deriveClientHoldings(
  movements: {
    product_id: string
    company_id: string | null
    company_name?: string | null
    quantity: unknown
    from_holder: string | null
    to_holder: string | null
  }[],
) {
  const map = new Map<string, { productId: string; companyId: string; name: string; quantity: number }>()
  for (const row of movements) {
    if (!row.company_id) continue
    if (row.to_holder !== 'client' && row.from_holder !== 'client') continue
    const key = `${row.product_id}:${row.company_id}`
    const current = map.get(key) || {
      productId: row.product_id,
      companyId: row.company_id,
      name: row.company_name || 'Client',
      quantity: 0,
    }
    const quantity = Number(row.quantity) || 0
    current.quantity += row.to_holder === 'client' ? quantity : -quantity
    if (row.company_name) current.name = row.company_name
    map.set(key, current)
  }
  return [...map.values()].filter((row) => row.quantity > 0)
}

export const HOLDER_LABEL: Record<string, string> = {
  office: 'Office',
  team: 'Team',
  client: 'Client',
  supplier: 'Supplier',
}
