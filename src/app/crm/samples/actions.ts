'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { withIdempotency } from '@/lib/idempotency'
import { isUuid } from '@/lib/utils'
import { planReceiveIntoOffice } from '@/lib/samples/ledger'

const SAMPLE_ROLES = ['admin', 'sales', 'operations', 'management'] as const
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

function done(flag: string): never {
  revalidatePath('/crm/samples')
  redirect(`/crm/samples?${flag}`)
}

function hint(message: string) {
  if (/sample_balances|holder_profile_id/i.test(message)) {
    return `${message} Apply ${MIGRATION}, then retry.`
  }
  return message
}

function wholeQty(raw: FormDataEntryValue | null) {
  const quantity = Number(raw || 0)
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false as const, error: 'Enter a positive whole quantity.' }
  return { ok: true as const, quantity }
}

function cleanNote(raw: FormDataEntryValue | null) {
  const note = String(raw || '').trim()
  if (note.length > 500) return { ok: false as const, error: 'Notes must be 500 characters or fewer.' }
  return { ok: true as const, note: note || null }
}

type Db = Awaited<ReturnType<typeof createClient>>

async function changeBalance(
  supabase: Db,
  input: { productId: string; companyId?: string | null; profileId?: string | null; delta: number },
): Promise<string | null> {
  const companyId = input.companyId || null
  const profileId = input.profileId || null
  let query = supabase.from('sample_balances').select('id, quantity').eq('product_id', input.productId)
  query = companyId
    ? query.eq('company_id', companyId).is('profile_id', null)
    : query.eq('profile_id', profileId).is('company_id', null)
  const { data, error } = await query.maybeSingle()
  if (error) return hint(error.message)

  const current = Number(data?.quantity || 0)
  const next = current + input.delta
  const empty = companyId ? 'That client is not holding this sample.' : 'That team member is not holding this sample.'
  if (next < 0 || (input.delta < 0 && !data)) return empty

  if (!data) {
    const inserted = await supabase.from('sample_balances').insert({
      product_id: input.productId,
      company_id: companyId,
      profile_id: profileId,
      quantity: next,
    })
    if (inserted.error) return hint(inserted.error.message)
    return null
  }

  const updated = await supabase
    .from('sample_balances')
    .update({ quantity: next, updated_at: new Date().toISOString() })
    .eq('id', data.id)
    .eq('quantity', current)
    .select('id')
  if (updated.error) return hint(updated.error.message)
  if (!updated.data?.length) return 'That sample changed while you were saving. Refresh and try again.'
  return null
}

async function casStock(
  supabase: Db,
  id: string,
  expected: Record<string, number>,
  next: Record<string, number>,
): Promise<string | null> {
  let query = supabase.from('sample_stock').update(next).eq('id', id)
  for (const [column, value] of Object.entries(expected)) {
    query = query.eq(column, value)
  }
  const { data, error } = await query.select('id')
  if (error) return error.message
  if (!data?.length) return 'That sample changed while you were saving. Refresh and try again.'
  return null
}

async function stockForProduct(supabase: Db, productId: string) {
  const { data, error } = await supabase.from('sample_stock').select('*').eq('product_id', productId).maybeSingle()
  if (error) return { error: error.message, stock: null }
  if (!data) return { error: 'This product has no sample stock.', stock: null }
  return { error: null, stock: data as Record<string, number | string | null> & { id: string; product_id: string; unit_cost: number | null } }
}

const HOLDERS = {
  office: 'in_office',
  team: 'with_team',
  client: 'with_client',
  supplier: 'pending_supplier',
} as const

type Holder = keyof typeof HOLDERS

export async function receiveSample(formData: FormData) {
  return withIdempotency('crm.receiveSample', formData, () => receiveSampleOnce(formData))
}

async function receiveSampleOnce(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)

  const supabase = await createClient()
  const productId = String(formData.get('product_id') || '').trim()
  const quantity = wholeQty(formData.get('quantity'))
  const unitCost = Number(formData.get('unit_cost') || 0)
  if (!isUuid(productId)) fail('Select a product to receive from the supplier.')
  if (!quantity.ok) fail(quantity.error)
  if (!Number.isFinite(unitCost) || unitCost < 0) fail('Unit cost cannot be negative.')

  const { data: existing, error: existingError } = await supabase
    .from('sample_stock')
    .select('id, in_office, unit_cost')
    .eq('product_id', productId)
    .maybeSingle()
  if (existingError) fail(existingError.message)

  if (existing) {
    const inOffice = Number(existing.in_office || 0)
    const stockError = await casStock(
      supabase,
      existing.id,
      { in_office: inOffice },
      { in_office: inOffice + quantity.quantity, unit_cost: unitCost || Number(existing.unit_cost || 0) },
    )
    if (stockError) fail(stockError)
  } else {
    const { error } = await supabase.from('sample_stock').insert({
      product_id: productId,
      in_office: quantity.quantity,
      with_team: 0,
      with_client: 0,
      pending_supplier: 0,
      unit_cost: unitCost || 0,
    })
    if (error) fail(error.message)
  }

  const { error: movementError } = await supabase.from('sample_movements').insert({
    product_id: productId,
    quantity: quantity.quantity,
    from_holder: 'supplier',
    to_holder: 'office',
    cost: unitCost || 0,
    note: 'Received from supplier into office',
    created_by: access.profile.id,
  })
  if (movementError) fail(movementError.message)

  done('received=1')
}

export async function receiveIntoOffice(formData: FormData) {
  return withIdempotency('crm.receiveIntoOffice', formData, () => receiveIntoOfficeOnce(formData))
}

async function receiveIntoOfficeOnce(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)

  const productId = String(formData.get('product_id') || '').trim()
  const companyId = String(formData.get('company_id') || '').trim()
  const quantity = wholeQty(formData.get('quantity'))
  const note = cleanNote(formData.get('note'))
  if (!isUuid(productId)) fail('Select a product to receive into the office.')
  if (!isUuid(companyId)) fail('Select the client who is returning the sample.')
  if (!quantity.ok) fail(quantity.error)
  if (!note.ok) fail(note.error)

  const supabase = await createClient()
  const loaded = await stockForProduct(supabase, productId)
  if (!loaded.stock) fail(loaded.error || 'Sample stock not found.')
  const stock = loaded.stock

  const balance = await supabase
    .from('sample_balances')
    .select('quantity')
    .eq('product_id', productId)
    .eq('company_id', companyId)
    .is('profile_id', null)
    .maybeSingle()
  if (balance.error) fail(hint(balance.error.message))

  const inOffice = Number(stock.in_office || 0)
  const withClient = Number(stock.with_client || 0)
  const heldByClient = Number(balance.data?.quantity || 0)
  const plan = planReceiveIntoOffice({
    quantity: quantity.quantity,
    heldByClient,
    inOffice,
    withClient,
  })
  if (!plan.ok) fail(plan.error)

  const balanceError = await changeBalance(supabase, {
    productId,
    companyId,
    delta: -quantity.quantity,
  })
  if (balanceError) fail(balanceError)

  const stockError = await casStock(
    supabase,
    stock.id,
    { in_office: inOffice, with_client: withClient },
    { in_office: plan.inOffice, with_client: plan.withClient },
  )
  if (stockError) {
    await changeBalance(supabase, { productId, companyId, delta: quantity.quantity })
    fail(stockError)
  }

  const { error: movementError } = await supabase.from('sample_movements').insert({
    product_id: productId,
    quantity: quantity.quantity,
    from_holder: 'client',
    to_holder: 'office',
    company_id: companyId,
    cost: Number(stock.unit_cost || 0),
    note: note.note,
    created_by: access.profile.id,
  })
  if (movementError) {
    await changeBalance(supabase, { productId, companyId, delta: quantity.quantity })
    await casStock(
      supabase,
      stock.id,
      { in_office: plan.inOffice, with_client: plan.withClient },
      { in_office: inOffice, with_client: withClient },
    )
    fail(movementError.message)
  }

  done('returned=client')
}

export async function sendSample(formData: FormData) {
  return withIdempotency('crm.sendSample', formData, () => sendSampleOnce(formData))
}

async function sendSampleOnce(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)

  const productId = String(formData.get('product_id') || '').trim()
  const destination = String(formData.get('destination') || '')
  const companyId = String(formData.get('company_id') || '').trim()
  const profileId = String(formData.get('profile_id') || '').trim()
  const quantity = wholeQty(formData.get('quantity'))
  const note = cleanNote(formData.get('note'))
  if (!isUuid(productId)) fail('Select a product to send.')
  if (destination !== 'company' && destination !== 'team') fail('Choose a client company or a team member.')
  if (destination === 'company' && !isUuid(companyId)) fail('Select the client receiving the sample.')
  if (destination === 'team' && !isUuid(profileId)) fail('Select the team member receiving the sample.')
  if (!quantity.ok) fail(quantity.error)
  if (!note.ok) fail(note.error)

  const supabase = await createClient()
  const loaded = await stockForProduct(supabase, productId)
  if (!loaded.stock) fail(loaded.error || 'Sample stock not found.')
  const stock = loaded.stock
  const inOffice = Number(stock.in_office || 0)
  if (inOffice < quantity.quantity) fail(`Only ${inOffice} in the office.`)

  const column = destination === 'company' ? 'with_client' : 'with_team'
  const current = Number(stock[column] || 0)
  const balanceError = await changeBalance(supabase, {
    productId,
    companyId: destination === 'company' ? companyId : null,
    profileId: destination === 'team' ? profileId : null,
    delta: quantity.quantity,
  })
  if (balanceError) fail(balanceError)

  const stockError = await casStock(
    supabase,
    stock.id,
    { in_office: inOffice, [column]: current },
    { in_office: inOffice - quantity.quantity, [column]: current + quantity.quantity },
  )
  if (stockError) {
    await changeBalance(supabase, {
      productId,
      companyId: destination === 'company' ? companyId : null,
      profileId: destination === 'team' ? profileId : null,
      delta: -quantity.quantity,
    })
    fail(stockError)
  }

  const movement: Record<string, unknown> = {
    product_id: productId,
    quantity: quantity.quantity,
    from_holder: 'office',
    to_holder: destination === 'company' ? 'client' : 'team',
    company_id: destination === 'company' ? companyId : null,
    cost: Number(stock.unit_cost || 0),
    note: note.note,
    created_by: access.profile.id,
  }
  if (destination === 'team') movement.holder_profile_id = profileId
  const { error: movementError } = await supabase.from('sample_movements').insert(movement)
  if (movementError) {
    await changeBalance(supabase, {
      productId,
      companyId: destination === 'company' ? companyId : null,
      profileId: destination === 'team' ? profileId : null,
      delta: -quantity.quantity,
    })
    await casStock(
      supabase,
      stock.id,
      { in_office: inOffice - quantity.quantity, [column]: current + quantity.quantity },
      { in_office: inOffice, [column]: current },
    )
    fail(hint(movementError.message))
  }

  done('sent=1')
}

export async function returnSampleFromTeam(formData: FormData) {
  return withIdempotency('crm.returnSampleFromTeam', formData, () => returnSampleFromTeamOnce(formData))
}

async function returnSampleFromTeamOnce(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)

  const productId = String(formData.get('product_id') || '').trim()
  const profileId = String(formData.get('profile_id') || '').trim()
  const quantity = wholeQty(formData.get('quantity'))
  const note = cleanNote(formData.get('note'))
  if (!isUuid(productId)) fail('Select a product to receive into the office.')
  if (!isUuid(profileId)) fail('Select the team member returning the sample.')
  if (!quantity.ok) fail(quantity.error)
  if (!note.ok) fail(note.error)

  const supabase = await createClient()
  const loaded = await stockForProduct(supabase, productId)
  if (!loaded.stock) fail(loaded.error || 'Sample stock not found.')
  const stock = loaded.stock
  const inOffice = Number(stock.in_office || 0)
  const withTeam = Number(stock.with_team || 0)

  const balance = await supabase
    .from('sample_balances')
    .select('quantity')
    .eq('product_id', productId)
    .eq('profile_id', profileId)
    .is('company_id', null)
    .maybeSingle()
  if (balance.error) fail(hint(balance.error.message))
  const held = Number(balance.data?.quantity || 0)
  if (!Number.isInteger(held) || held < 1) fail('That team member is not holding this sample.')
  if (quantity.quantity > held) fail(`That team member holds ${held}.`)
  if (quantity.quantity > withTeam) fail(`Only ${withTeam} are with the team.`)

  const balanceError = await changeBalance(supabase, { productId, profileId, delta: -quantity.quantity })
  if (balanceError) fail(balanceError)

  const stockError = await casStock(
    supabase,
    stock.id,
    { in_office: inOffice, with_team: withTeam },
    { in_office: inOffice + quantity.quantity, with_team: withTeam - quantity.quantity },
  )
  if (stockError) {
    await changeBalance(supabase, { productId, profileId, delta: quantity.quantity })
    fail(stockError)
  }

  const { error: movementError } = await supabase.from('sample_movements').insert({
    product_id: productId,
    quantity: quantity.quantity,
    from_holder: 'team',
    to_holder: 'office',
    holder_profile_id: profileId,
    cost: Number(stock.unit_cost || 0),
    note: note.note,
    created_by: access.profile.id,
  })
  if (movementError) {
    await changeBalance(supabase, { productId, profileId, delta: quantity.quantity })
    await casStock(
      supabase,
      stock.id,
      { in_office: inOffice + quantity.quantity, with_team: withTeam - quantity.quantity },
      { in_office: inOffice, with_team: withTeam },
    )
    fail(hint(movementError.message))
  }

  done('returned=team')
}

export async function moveSample(formData: FormData) {
  const access = await requireSampleAccess()
  if (!access.ok) fail(access.error)

  const supabase = await createClient()
  const stockId = String(formData.get('stock_id') || '')
  const from = String(formData.get('from_holder') || '') as Holder
  const to = String(formData.get('to_holder') || '') as Holder
  const quantity = wholeQty(formData.get('quantity'))
  const companyId = String(formData.get('company_id') || '') || null
  const profileId = String(formData.get('profile_id') || '') || null
  const note = cleanNote(formData.get('note'))
  if (!stockId || !(from in HOLDERS) || !(to in HOLDERS) || from === to) fail('Valid movement details are required.')
  if (!quantity.ok) fail(quantity.error)
  if (!note.ok) fail(note.error)
  if ((to === 'client' || from === 'client') && !companyId) fail('Select the client company for this movement.')
  if ((to === 'team' || from === 'team') && !profileId) fail('Select the team member for this movement.')

  const { data: stock, error: stockError } = await supabase.from('sample_stock').select('*').eq('id', stockId).single()
  if (stockError || !stock) fail(stockError?.message || 'Sample stock not found.')

  const stockRow = stock as Record<string, number | string | null>
  const fromCol = HOLDERS[from]
  const toCol = HOLDERS[to]
  const available = Number(stockRow[fromCol] || 0)
  const destination = Number(stockRow[toCol] || 0)
  if (available < quantity.quantity) fail(`Only ${available} available at ${from}.`)

  if (from === 'client' && companyId) {
    const balanceError = await changeBalance(supabase, { productId: String(stock.product_id), companyId, delta: -quantity.quantity })
    if (balanceError) fail(balanceError)
  }
  if (from === 'team' && profileId) {
    const balanceError = await changeBalance(supabase, { productId: String(stock.product_id), profileId, delta: -quantity.quantity })
    if (balanceError) fail(balanceError)
  }
  if (to === 'client' && companyId) {
    const balanceError = await changeBalance(supabase, { productId: String(stock.product_id), companyId, delta: quantity.quantity })
    if (balanceError) fail(balanceError)
  }
  if (to === 'team' && profileId) {
    const balanceError = await changeBalance(supabase, { productId: String(stock.product_id), profileId, delta: quantity.quantity })
    if (balanceError) fail(balanceError)
  }

  const stockWriteError = await casStock(
    supabase,
    stockId,
    { [fromCol]: available, [toCol]: destination },
    { [fromCol]: available - quantity.quantity, [toCol]: destination + quantity.quantity },
  )
  if (stockWriteError) {
    const productId = String(stock.product_id)
    if (from === 'client' && companyId) await changeBalance(supabase, { productId, companyId, delta: quantity.quantity })
    if (from === 'team' && profileId) await changeBalance(supabase, { productId, profileId, delta: quantity.quantity })
    if (to === 'client' && companyId) await changeBalance(supabase, { productId, companyId, delta: -quantity.quantity })
    if (to === 'team' && profileId) await changeBalance(supabase, { productId, profileId, delta: -quantity.quantity })
    fail(stockWriteError)
  }

  const movement: Record<string, unknown> = {
    product_id: stock.product_id,
    quantity: quantity.quantity,
    from_holder: from,
    to_holder: to,
    company_id: to === 'client' || from === 'client' ? companyId : null,
    cost: stock.unit_cost || 0,
    note: note.note,
    created_by: access.profile.id,
  }
  if (to === 'team' || from === 'team') movement.holder_profile_id = profileId
  const { error: movementError } = await supabase.from('sample_movements').insert(movement)
  if (movementError) {
    const productId = String(stock.product_id)
    if (from === 'client' && companyId) await changeBalance(supabase, { productId, companyId, delta: quantity.quantity })
    if (from === 'team' && profileId) await changeBalance(supabase, { productId, profileId, delta: quantity.quantity })
    if (to === 'client' && companyId) await changeBalance(supabase, { productId, companyId, delta: -quantity.quantity })
    if (to === 'team' && profileId) await changeBalance(supabase, { productId, profileId, delta: -quantity.quantity })
    await casStock(
      supabase,
      stockId,
      { [fromCol]: available - quantity.quantity, [toCol]: destination + quantity.quantity },
      { [fromCol]: available, [toCol]: destination },
    )
    fail(hint(movementError.message))
  }

  done('sent=1')
}
