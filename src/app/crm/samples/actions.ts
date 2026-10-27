'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { withIdempotency } from '@/lib/idempotency'
import { sampleSchemaMissing } from '@/lib/samples/opening-stock'
import {
  SAMPLE_MANAGE_ROLES,
  SAMPLE_VIEW_ROLES,
  netHolderQuantity,
  planReceiveIntoOffice,
  planSendSample,
  type SampleCounts,
  type SampleMovementDraft,
} from '@/lib/samples/ledger'
import type { SupabaseClient } from '@supabase/supabase-js'

async function requireSampleAccess() {
  const profile = await getProfile()
  if (!profile) return { ok: false as const, error: 'Not authenticated' }
  if (!(SAMPLE_MANAGE_ROLES as readonly string[]).includes(profile.role)) {
    return { ok: false as const, error: 'Not permitted to manage samples' }
  }
  return { ok: true as const, profile }
}

function fail(message: string): never {
  redirect(`/crm/samples?error=${encodeURIComponent(message)}`)
}

function ok(flag: 'received' | 'moved' | 'returned' | 'sent'): never {
  revalidatePath('/crm/samples')
  revalidatePath('/crm/dashboard')
  revalidatePath('/crm/reports')
  redirect(`/crm/samples?${flag}=1`)
}

const HOLDERS = {
  office: 'in_office',
  team: 'with_team',
  client: 'with_client',
  supplier: 'pending_supplier',
} as const

type Holder = keyof typeof HOLDERS

function countsOf(stock: Record<string, unknown>): SampleCounts {
  return {
    in_office: Number(stock.in_office) || 0,
    with_team: Number(stock.with_team) || 0,
    with_client: Number(stock.with_client) || 0,
    pending_supplier: Number(stock.pending_supplier) || 0,
  }
}

async function insertMovement(supabase: SupabaseClient, draft: SampleMovementDraft, actorId: string, cost: number) {
  const row: Record<string, unknown> = {
    product_id: draft.product_id,
    quantity: draft.quantity,
    from_holder: draft.from_holder,
    to_holder: draft.to_holder,
    company_id: draft.company_id,
    holder_profile_id: draft.holder_profile_id,
    condition: draft.condition,
    cost,
    note: draft.note,
    created_by: actorId,
  }
  let { error } = await supabase.from('sample_movements').insert(row)
  if (error && /holder_profile_id|condition/i.test(error.message)) {
    delete row.holder_profile_id
    delete row.condition
    const extra = [draft.condition, draft.holder_profile_id ? `Team member ${draft.holder_profile_id}` : null]
      .filter(Boolean)
      .join(' · ')
    row.note = [draft.note, extra].filter(Boolean).join(' · ') || null
    error = (await supabase.from('sample_movements').insert(row)).error
  }
  return error
}

async function writePartyHolding(
  supabase: SupabaseClient,
  input: { productId: string; companyId?: string | null; profileId?: string | null; quantity: number },
): Promise<string | null> {
  const companyId = input.companyId || null
  const profileId = input.profileId || null
  if (Boolean(companyId) === Boolean(profileId)) return 'Sample balance needs one client or one team member.'
  if (input.quantity < 0) return 'Sample balance cannot go below zero.'

  let query = supabase.from('sample_holdings').select('id, quantity').eq('product_id', input.productId)
  query = companyId ? query.eq('company_id', companyId) : query.eq('profile_id', profileId)
  const existing = await query.maybeSingle()
  if (existing.error) {
    if (sampleSchemaMissing(existing.error.message)) return null
    return existing.error.message
  }
  if (existing.data) {
    const { error } = await supabase
      .from('sample_holdings')
      .update({ quantity: input.quantity, updated_at: new Date().toISOString() })
      .eq('id', existing.data.id)
    return error?.message ?? null
  }
  const { error } = await supabase.from('sample_holdings').insert({
    product_id: input.productId,
    company_id: companyId,
    profile_id: profileId,
    quantity: input.quantity,
  })
  if (error && sampleSchemaMissing(error.message)) return null
  return error?.message ?? null
}

async function readPartyHolding(
  supabase: SupabaseClient,
  input: { productId: string; companyId?: string | null; profileId?: string | null; holder: 'client' | 'team' },
): Promise<{ qty: number } | { error: string }> {
  const companyId = input.companyId || null
  const profileId = input.profileId || null
  if (!companyId && !profileId) return { qty: 0 }
  let query = supabase.from('sample_holdings').select('quantity').eq('product_id', input.productId)
  query = companyId ? query.eq('company_id', companyId) : query.eq('profile_id', profileId)
  const held = await query.maybeSingle()
  if (!held.error) return { qty: Number(held.data?.quantity) || 0 }
  if (!sampleSchemaMissing(held.error.message)) return { error: held.error.message }

  const movements = await supabase
    .from('sample_movements')
    .select('quantity, from_holder, to_holder, company_id, holder_profile_id')
    .eq('product_id', input.productId)
  if (movements.error && /holder_profile_id/i.test(movements.error.message)) {
    const legacy = await supabase
      .from('sample_movements')
      .select('quantity, from_holder, to_holder, company_id')
      .eq('product_id', input.productId)
    if (legacy.error) return { error: legacy.error.message }
    if (input.holder !== 'client' || !companyId) return { qty: 0 }
    const rows = (legacy.data || []).filter((row) => row.company_id === companyId)
    return { qty: Math.max(0, netHolderQuantity(rows, 'client')) }
  }
  if (movements.error) return { error: movements.error.message }
  const rows = (movements.data || []).filter((row) => {
    if (input.holder === 'client') return row.company_id === companyId
    return row.holder_profile_id === profileId
  })
  return { qty: Math.max(0, netHolderQuantity(rows, input.holder)) }
}

async function assertCompany(supabase: SupabaseClient, companyId: string) {
  const { data, error } = await supabase.from('companies').select('id').eq('id', companyId).maybeSingle()
  if (error) return error.message
  if (!data) return 'Select a client company.'
  return null
}

async function assertTeamMember(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', profileId)
    .maybeSingle()
  if (error) return error.message
  if (!data || !data.is_active || !(SAMPLE_VIEW_ROLES as readonly string[]).includes(data.role)) {
    return 'Select a team member.'
  }
  return null
}

export async function receiveSample(formData: FormData) {
  return withIdempotency('crm.receiveSample', formData, () => receiveSampleOnce(formData))
}

async function receiveSampleOnce(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)

  const supabase = await createClient()
  const productId = String(formData.get('product_id') || '').trim()
  const quantity = Number(formData.get('quantity') || 0)
  const unitCost = Number(formData.get('unit_cost') || 0)
  if (!productId) fail('Select a product to receive into office.')
  if (!Number.isInteger(quantity) || quantity < 1) fail('Enter a positive whole quantity.')
  if (!Number.isFinite(unitCost) || unitCost < 0) fail('Unit cost cannot be negative.')

  const { data: existing, error: existingError } = await supabase
    .from('sample_stock')
    .select('id, in_office, unit_cost')
    .eq('product_id', productId)
    .maybeSingle()
  if (existingError) fail(existingError.message)

  if (existing) {
    const { error } = await supabase
      .from('sample_stock')
      .update({
        in_office: (existing.in_office || 0) + quantity,
        unit_cost: unitCost || existing.unit_cost,
      })
      .eq('id', existing.id)
    if (error) fail(error.message)
  } else {
    const { error } = await supabase.from('sample_stock').insert({
      product_id: productId,
      in_office: quantity,
      with_team: 0,
      with_client: 0,
      pending_supplier: 0,
      unit_cost: unitCost || 0,
    })
    if (error) fail(error.message)
  }

  const { error: movementError } = await supabase.from('sample_movements').insert({
    product_id: productId,
    quantity,
    from_holder: 'supplier',
    to_holder: 'office',
    cost: unitCost || 0,
    note: 'Received into office sample stock',
    created_by: access.profile.id,
  })
  if (movementError) fail(movementError.message)

  ok('received')
}

export async function sendSample(formData: FormData) {
  return withIdempotency('crm.sendSample', formData, () => sendSampleOnce(formData))
}

async function sendSampleOnce(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)
  const supabase = await createClient()
  const productId = String(formData.get('product_id') || '').trim()
  const destination = String(formData.get('destination') || '')
  const companyId = String(formData.get('company_id') || '').trim()
  const profileId = String(formData.get('profile_id') || '').trim()
  const from = String(formData.get('from_holder') || 'office')
  const fromProfileId = String(formData.get('from_profile_id') || '').trim()

  const { data: stock, error: stockError } = await supabase
    .from('sample_stock')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle()
  if (stockError || !stock) fail(stockError?.message || 'Sample stock not found.')

  const clientRead =
    destination === 'client' && companyId
      ? await readPartyHolding(supabase, { productId, companyId, holder: 'client' })
      : { qty: 0 }
  if ('error' in clientRead) fail(clientRead.error)
  const teamRead =
    destination === 'team' && profileId
      ? await readPartyHolding(supabase, { productId, profileId, holder: 'team' })
      : { qty: 0 }
  if ('error' in teamRead) fail(teamRead.error)
  const sourceRead =
    from === 'team' && fromProfileId
      ? await readPartyHolding(supabase, { productId, profileId: fromProfileId, holder: 'team' })
      : { qty: 0 }
  if ('error' in sourceRead) fail(sourceRead.error)

  const planned = planSendSample({
    productId,
    destination,
    companyId,
    profileId,
    from,
    fromProfileId,
    quantity: formData.get('quantity'),
    note: formData.get('note'),
    stock: countsOf(stock),
    clientHolding: clientRead.qty,
    teamHolding: teamRead.qty,
    sourceTeamHolding: sourceRead.qty,
  })
  if (!planned.ok) fail(planned.error)

  if (planned.movement.company_id) {
    const companyError = await assertCompany(supabase, planned.movement.company_id)
    if (companyError) fail(companyError)
  }
  if (destination === 'team') {
    const memberError = await assertTeamMember(supabase, profileId)
    if (memberError) fail(memberError)
  }
  if (from === 'team') {
    const memberError = await assertTeamMember(supabase, fromProfileId)
    if (memberError) fail(memberError)
  }

  const { error } = await supabase
    .from('sample_stock')
    .update({
      in_office: planned.stock.in_office,
      with_team: planned.stock.with_team,
      with_client: planned.stock.with_client,
      pending_supplier: planned.stock.pending_supplier,
    })
    .eq('id', stock.id)
  if (error) fail(error.message)

  const revertStock = async () => {
    await supabase
      .from('sample_stock')
      .update({
        in_office: stock.in_office,
        with_team: stock.with_team,
        with_client: stock.with_client,
        pending_supplier: stock.pending_supplier,
      })
      .eq('id', stock.id)
  }
  const revertHoldings = async () => {
    if (planned.movement.company_id) {
      await writePartyHolding(supabase, { productId, companyId: planned.movement.company_id, quantity: clientRead.qty })
    }
    if (fromProfileId) {
      await writePartyHolding(supabase, { productId, profileId: fromProfileId, quantity: sourceRead.qty })
    }
    if (destination === 'team' && profileId) {
      await writePartyHolding(supabase, { productId, profileId, quantity: teamRead.qty })
    }
  }

  const holdingWrites: Array<Promise<string | null>> = []
  if (planned.clientHolding != null && planned.movement.company_id) {
    holdingWrites.push(writePartyHolding(supabase, {
      productId,
      companyId: planned.movement.company_id,
      quantity: planned.clientHolding,
    }))
  }
  if (planned.sourceTeamHolding != null && fromProfileId) {
    holdingWrites.push(writePartyHolding(supabase, {
      productId,
      profileId: fromProfileId,
      quantity: planned.sourceTeamHolding,
    }))
  }
  if (planned.teamHolding != null && profileId) {
    holdingWrites.push(writePartyHolding(supabase, {
      productId,
      profileId,
      quantity: planned.teamHolding,
    }))
  }
  const holdingError = (await Promise.all(holdingWrites)).find((message) => message)
  if (holdingError) {
    await revertHoldings()
    await revertStock()
    fail(holdingError)
  }

  const movementError = await insertMovement(supabase, planned.movement, access.profile.id, Number(stock.unit_cost) || 0)
  if (movementError) {
    await revertHoldings()
    await revertStock()
    fail(movementError.message)
  }
  ok('sent')
}

export async function receiveIntoOffice(formData: FormData) {
  return withIdempotency('crm.receiveIntoOffice', formData, () => receiveIntoOfficeOnce(formData))
}

async function receiveIntoOfficeOnce(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)
  const supabase = await createClient()
  const productId = String(formData.get('product_id') || '').trim()
  const companyId = String(formData.get('company_id') || '').trim()

  const { data: stock, error: stockError } = await supabase
    .from('sample_stock')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle()
  if (stockError) fail(stockError.message)
  if (!stock) fail('Sample stock not found.')

  const held = companyId
    ? await readPartyHolding(supabase, { productId, companyId, holder: 'client' })
    : { qty: 0 }
  if ('error' in held) fail(held.error)

  const planned = planReceiveIntoOffice({
    productId,
    companyId,
    quantity: formData.get('quantity'),
    condition: formData.get('condition'),
    note: formData.get('note'),
    stock: countsOf(stock),
    clientHolding: held.qty,
  })
  if (!planned.ok) fail(planned.error)

  const companyError = await assertCompany(supabase, planned.movement.company_id || '')
  if (companyError) fail(companyError)

  const { error } = await supabase
    .from('sample_stock')
    .update({ in_office: planned.inOffice, with_client: planned.withClient })
    .eq('id', stock.id)
  if (error) fail(error.message)

  const holdingError = await writePartyHolding(supabase, {
    productId,
    companyId: planned.movement.company_id,
    quantity: planned.clientHolding,
  })
  if (holdingError) {
    await supabase
      .from('sample_stock')
      .update({ in_office: stock.in_office, with_client: stock.with_client })
      .eq('id', stock.id)
    fail(holdingError)
  }

  const movementError = await insertMovement(supabase, planned.movement, access.profile.id, Number(stock.unit_cost) || 0)
  if (movementError) {
    await writePartyHolding(supabase, { productId, companyId, quantity: held.qty })
    await supabase
      .from('sample_stock')
      .update({ in_office: stock.in_office, with_client: stock.with_client })
      .eq('id', stock.id)
    fail(movementError.message)
  }

  ok('returned')
}

export async function moveSample(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)

  const supabase = await createClient()
  const user = { id: access.profile.id }
  const stockId = String(formData.get('stock_id') || '')
  const from = String(formData.get('from_holder') || '') as Holder
  const to = String(formData.get('to_holder') || '') as Holder
  const quantity = Number(formData.get('quantity') || 0)
  const companyId = String(formData.get('company_id') || '') || null
  const profileId = String(formData.get('profile_id') || '') || null
  const note = String(formData.get('note') || '') || null
  if (!stockId || !(from in HOLDERS) || !(to in HOLDERS) || from === to || !Number.isInteger(quantity) || quantity < 1) {
    fail('Valid movement details are required.')
  }
  if (to === 'client' && !companyId) fail('Select the client receiving the sample.')

  const { data: stock, error: stockError } = await supabase.from('sample_stock').select('*').eq('id', stockId).single()
  if (stockError || !stock) fail(stockError?.message || 'Sample stock not found.')

  const stockRow = stock as Record<string, number | string | null>
  const fromCol = HOLDERS[from]
  const toCol = HOLDERS[to]
  const available = Number(stockRow[fromCol] || 0)
  if (available < quantity) fail(`Only ${available} available at ${from}.`)

  let nextClient: number | null = null
  let nextProfile: number | null = null
  if (companyId && (from === 'client' || to === 'client')) {
    const current = await readPartyHolding(supabase, { productId: String(stock.product_id), companyId, holder: 'client' })
    if ('error' in current) fail(current.error)
    nextClient = current.qty + (to === 'client' ? quantity : 0) - (from === 'client' ? quantity : 0)
    if (nextClient < 0) fail(`This client holds ${current.qty}.`)
  }
  if (profileId && (from === 'team' || to === 'team')) {
    const current = await readPartyHolding(supabase, { productId: String(stock.product_id), profileId, holder: 'team' })
    if ('error' in current) fail(current.error)
    nextProfile = current.qty + (to === 'team' ? quantity : 0) - (from === 'team' ? quantity : 0)
    if (nextProfile < 0) fail(`This team member holds ${current.qty}.`)
  }

  const { error } = await supabase
    .from('sample_stock')
    .update({
      [fromCol]: available - quantity,
      [toCol]: Number(stockRow[toCol] || 0) + quantity,
    })
    .eq('id', stockId)
  if (error) fail(error.message)

  if (nextClient != null && companyId) {
    const holdingError = await writePartyHolding(supabase, {
      productId: String(stock.product_id),
      companyId,
      quantity: nextClient,
    })
    if (holdingError) fail(holdingError)
  }
  if (nextProfile != null && profileId) {
    const holdingError = await writePartyHolding(supabase, {
      productId: String(stock.product_id),
      profileId,
      quantity: nextProfile,
    })
    if (holdingError) fail(holdingError)
  }

  const movementError = await insertMovement(
    supabase,
    {
      product_id: String(stock.product_id),
      quantity,
      from_holder: from,
      to_holder: to,
      company_id: from === 'client' || to === 'client' ? companyId : null,
      holder_profile_id: from === 'team' || to === 'team' ? profileId : null,
      condition: null,
      note,
    },
    user.id,
    Number(stock.unit_cost) || 0,
  )
  if (movementError) fail(movementError.message)

  ok('moved')
}
