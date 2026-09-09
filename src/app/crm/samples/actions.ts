'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'

const SAMPLE_ROLES = ['admin', 'sales', 'operations'] as const

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

function ok(flag: 'received' | 'moved'): never {
  revalidatePath('/crm/samples')
  redirect(`/crm/samples?${flag}=1`)
}

const HOLDERS = {
  office: 'in_office',
  team: 'with_team',
  client: 'with_client',
  supplier: 'pending_supplier',
} as const

type Holder = keyof typeof HOLDERS

export async function receiveSample(formData: FormData) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error: movementError } = await supabase.from('sample_movements').insert({
    product_id: productId,
    quantity,
    from_holder: 'supplier',
    to_holder: 'office',
    cost: unitCost || 0,
    note: 'Received into office sample stock',
    created_by: user?.id,
  })
  if (movementError) fail(movementError.message)

  ok('received')
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

  const { error } = await supabase
    .from('sample_stock')
    .update({
      [fromCol]: available - quantity,
      [toCol]: Number(stockRow[toCol] || 0) + quantity,
    })
    .eq('id', stockId)
  if (error) fail(error.message)

  const { error: movementError } = await supabase.from('sample_movements').insert({
    product_id: stock.product_id,
    quantity,
    from_holder: from,
    to_holder: to,
    company_id: to === 'client' || from === 'client' ? companyId : null,
    cost: stock.unit_cost || 0,
    note,
    created_by: user?.id,
  })
  if (movementError) fail(movementError.message)

  ok('moved')
}
