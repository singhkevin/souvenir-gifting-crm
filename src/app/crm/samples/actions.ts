'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { withIdempotency } from '@/lib/idempotency'
import { isUuid } from '@/lib/utils'
import { planSampleTransfer, type SampleCounts, type SampleHolder } from '@/lib/samples/ledger'

const SAMPLE_ROLES = ['admin', 'sales', 'operations'] as const
const MIGRATION = 'supabase/migrations/20261027_samples_internal.sql'

async function requireSampleAccess() {
  const profile = await getProfile()
  if (!profile) return { ok: false as const, error: 'Not authenticated' }
  if (!SAMPLE_ROLES.includes(profile.role as (typeof SAMPLE_ROLES)[number])) {
    return { ok: false as const, error: 'Not permitted to manage samples' }
  }
  return { ok: true as const, profile }
}

function fail(message: string): never {
  redirect(`/crm/samples?error=${encodeURIComponent(message)}`)
}

function ok(flag: 'received' | 'moved' | 'sent' | 'returned'): never {
  revalidatePath('/crm/samples')
  redirect(`/crm/samples?${flag}=1`)
}

function countsOf(row: {
  in_office?: number | null
  with_team?: number | null
  with_client?: number | null
  pending_supplier?: number | null
}): SampleCounts {
  return {
    inOffice: Number(row.in_office || 0),
    withTeam: Number(row.with_team || 0),
    withClient: Number(row.with_client || 0),
    pendingSupplier: Number(row.pending_supplier || 0),
  }
}

function missingTable(message: string) {
  return /sample_holder_balances|schema cache|does not exist/i.test(message)
}

async function holderQuantity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  column: 'company_id' | 'holder_profile_id',
  id: string,
): Promise<{ qty: number; error: string | null }> {
  const { data, error } = await supabase
    .from('sample_holder_balances')
    .select('quantity')
    .eq('product_id', productId)
    .eq(column, id)
    .maybeSingle()
  if (error) {
    if (missingTable(error.message)) {
      return { qty: 0, error: `Sample holders need ${MIGRATION}. Apply it, then try again.` }
    }
    return { qty: 0, error: error.message }
  }
  return { qty: Number(data?.quantity || 0), error: null }
}

async function setHolderQuantity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  column: 'company_id' | 'holder_profile_id',
  id: string,
  next: number,
  previous: number,
): Promise<string | null> {
  if (next < 0) return 'Quantity is higher than what they hold.'
  const { data: row, error: readError } = await supabase
    .from('sample_holder_balances')
    .select('id, quantity')
    .eq('product_id', productId)
    .eq(column, id)
    .maybeSingle()
  if (readError) return missingTable(readError.message) ? `Sample holders need ${MIGRATION}.` : readError.message

  if (!row) {
    if (next === 0) return null
    const inserted = column === 'company_id'
      ? await supabase.from('sample_holder_balances').insert({
          product_id: productId,
          company_id: id,
          holder_profile_id: null,
          quantity: next,
        })
      : await supabase.from('sample_holder_balances').insert({
          product_id: productId,
          company_id: null,
          holder_profile_id: id,
          quantity: next,
        })
    return inserted.error?.message || null
  }

  if (Number(row.quantity) !== previous) return 'Sample balance changed. Refresh and try again.'
  const updated = await supabase
    .from('sample_holder_balances')
    .update({ quantity: next, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('quantity', previous)
    .select('id')
    .maybeSingle()
  if (updated.error) return updated.error.message
  if (!updated.data) return 'Sample balance changed. Refresh and try again.'
  return null
}

async function applyTransfer(input: {
  stockId: string
  from: SampleHolder
  to: SampleHolder
  quantity: number
  companyId: string | null
  teamProfileId: string | null
  note: string | null
  userId: string
  flag: 'moved' | 'sent' | 'returned'
}) {
  const supabase = await createClient()
  const { data: stock, error: stockError } = await supabase.from('sample_stock').select('*').eq('id', input.stockId).single()
  if (stockError || !stock) fail(stockError?.message || 'Sample stock not found.')

  const companyNeeded = input.from === 'client' || input.to === 'client'
  const teamNeeded = input.from === 'team' || input.to === 'team'
  if (companyNeeded && !input.companyId) fail('Select the client company.')
  if (teamNeeded && !input.teamProfileId) fail('Select the team member.')
  if (input.from === 'team' && input.to === 'team') fail('Choose a different destination.')

  let companyHeld: number | null = null
  let teamHeld: number | null = null
  if (companyNeeded && input.companyId) {
    const held = await holderQuantity(supabase, stock.product_id, 'company_id', input.companyId)
    if (held.error) fail(held.error)
    companyHeld = held.qty
  }
  if (teamNeeded && input.teamProfileId) {
    const held = await holderQuantity(supabase, stock.product_id, 'holder_profile_id', input.teamProfileId)
    if (held.error) fail(held.error)
    teamHeld = held.qty
  }

  const plan = planSampleTransfer({
    from: input.from,
    to: input.to,
    quantity: input.quantity,
    stock: countsOf(stock),
    companyHeld,
    teamHeld,
  })
  if (!plan.ok) fail(plan.error)

  const revertHolders = async () => {
    if (companyNeeded && input.companyId && plan.companyHeld != null && companyHeld != null) {
      await setHolderQuantity(supabase, stock.product_id, 'company_id', input.companyId, companyHeld, plan.companyHeld)
    }
    if (teamNeeded && input.teamProfileId && plan.teamHeld != null && teamHeld != null) {
      await setHolderQuantity(
        supabase,
        stock.product_id,
        'holder_profile_id',
        input.teamProfileId,
        teamHeld,
        plan.teamHeld,
      )
    }
  }

  if (companyNeeded && input.companyId && plan.companyHeld != null && companyHeld != null) {
    const balanceError = await setHolderQuantity(
      supabase,
      stock.product_id,
      'company_id',
      input.companyId,
      plan.companyHeld,
      companyHeld,
    )
    if (balanceError) fail(balanceError)
  }
  if (teamNeeded && input.teamProfileId && plan.teamHeld != null && teamHeld != null) {
    const balanceError = await setHolderQuantity(
      supabase,
      stock.product_id,
      'holder_profile_id',
      input.teamProfileId,
      plan.teamHeld,
      teamHeld,
    )
    if (balanceError) {
      await revertHolders()
      fail(balanceError)
    }
  }

  const { data: updated, error } = await supabase
    .from('sample_stock')
    .update({
      in_office: plan.stock.inOffice,
      with_team: plan.stock.withTeam,
      with_client: plan.stock.withClient,
      pending_supplier: plan.stock.pendingSupplier,
    })
    .eq('id', input.stockId)
    .eq('in_office', Number(stock.in_office || 0))
    .eq('with_team', Number(stock.with_team || 0))
    .eq('with_client', Number(stock.with_client || 0))
    .eq('pending_supplier', Number(stock.pending_supplier || 0))
    .select('id')
    .maybeSingle()
  if (error || !updated) {
    await revertHolders()
    fail(error?.message || 'Sample stock changed. Refresh and try again.')
  }

  const movementRow = {
    product_id: stock.product_id,
    quantity: input.quantity,
    from_holder: input.from,
    to_holder: input.to,
    company_id: companyNeeded ? input.companyId : null,
    holder_profile_id: teamNeeded ? input.teamProfileId : null,
    cost: stock.unit_cost || 0,
    note: input.note,
    created_by: input.userId,
  }
  let movement = await supabase.from('sample_movements').insert(movementRow)
  if (movement.error && /holder_profile_id/i.test(movement.error.message)) {
    const { holder_profile_id: _holder, ...withoutHolder } = movementRow
    void _holder
    movement = await supabase.from('sample_movements').insert(withoutHolder)
  }
  if (movement.error) {
    await supabase
      .from('sample_stock')
      .update({
        in_office: Number(stock.in_office || 0),
        with_team: Number(stock.with_team || 0),
        with_client: Number(stock.with_client || 0),
        pending_supplier: Number(stock.pending_supplier || 0),
      })
      .eq('id', input.stockId)
    await revertHolders()
    fail(movement.error.message)
  }

  ok(input.flag)
}

function cleanNote(value: FormDataEntryValue | null) {
  const note = String(value || '').trim()
  if (!note) return null
  return note.slice(0, 500)
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
  if (!productId) fail('Select a product to receive from the supplier.')
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
    note: cleanNote(formData.get('note')) || 'Received from supplier into office sample stock',
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

  const to = String(formData.get('to_holder') || '') as SampleHolder
  const from = String(formData.get('from_holder') || 'office') as SampleHolder
  if (to !== 'client' && to !== 'team') fail('Choose a client company or a team member.')
  if (from !== 'office' && from !== 'team') fail('Take the sample from the office or a team member.')

  const companyId = String(formData.get('company_id') || '').trim()
  const toProfileId = String(formData.get('to_profile_id') || '').trim()
  const fromProfileId = String(formData.get('from_profile_id') || '').trim()
  const quantity = Number(formData.get('quantity') || 0)
  const stockId = String(formData.get('stock_id') || '').trim()
  if (!stockId) fail('Select a product.')
  if (to === 'client' && !isUuid(companyId)) fail('Select the client company.')
  if (to === 'team' && !isUuid(toProfileId)) fail('Select the team member.')
  if (from === 'team' && !isUuid(fromProfileId)) fail('Select the team member who has the sample.')
  if (from === 'team' && to === 'team' && fromProfileId === toProfileId) {
    fail('Choose a different team member.')
  }

  const teamProfileId = to === 'team' ? toProfileId : from === 'team' ? fromProfileId : null
  await applyTransfer({
    stockId,
    from,
    to,
    quantity,
    companyId: to === 'client' ? companyId : null,
    teamProfileId,
    note: cleanNote(formData.get('note')),
    userId: access.profile.id,
    flag: 'sent',
  })
}

export async function receiveIntoOffice(formData: FormData) {
  return withIdempotency('crm.receiveIntoOffice', formData, () => receiveIntoOfficeOnce(formData))
}

async function receiveIntoOfficeOnce(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)

  const from = String(formData.get('from_holder') || 'client')
  if (from !== 'client' && from !== 'team') fail('Receive the sample from a client or a team member.')
  const companyId = String(formData.get('company_id') || '').trim()
  const profileId = String(formData.get('holder_profile_id') || '').trim()
  const quantity = Number(formData.get('quantity') || 0)
  const stockId = String(formData.get('stock_id') || '').trim()
  if (!stockId) fail('Select a product.')
  if (from === 'client' && !isUuid(companyId)) fail('Select the client who is returning the sample.')
  if (from === 'team' && !isUuid(profileId)) fail('Select the team member who is returning the sample.')

  await applyTransfer({
    stockId,
    from,
    to: 'office',
    quantity,
    companyId: from === 'client' ? companyId : null,
    teamProfileId: from === 'team' ? profileId : null,
    note: cleanNote(formData.get('note')),
    userId: access.profile.id,
    flag: 'returned',
  })
}

export async function moveSample(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)

  const from = String(formData.get('from_holder') || '') as SampleHolder
  const to = String(formData.get('to_holder') || '') as SampleHolder
  const holders: SampleHolder[] = ['office', 'team', 'client', 'supplier']
  if (!holders.includes(from) || !holders.includes(to)) fail('Valid movement details are required.')
  const companyId = String(formData.get('company_id') || '').trim()
  const profileId = String(formData.get('holder_profile_id') || '').trim()
  await applyTransfer({
    stockId: String(formData.get('stock_id') || '').trim(),
    from,
    to,
    quantity: Number(formData.get('quantity') || 0),
    companyId: isUuid(companyId) ? companyId : null,
    teamProfileId: isUuid(profileId) ? profileId : null,
    note: cleanNote(formData.get('note')),
    userId: access.profile.id,
    flag: 'moved',
  })
}
