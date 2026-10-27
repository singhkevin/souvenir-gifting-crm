import { createClient } from '@/lib/supabase/server'
import { requireStaff, canSeeCosts } from '@/lib/auth'
import { oneRelation } from '@/lib/utils'
import { SamplesBoard, type NamedOption, type SampleCard, type SampleMovement } from './samples-board'

const TEAM_ROLES = ['admin', 'sales', 'operations', 'accounts', 'management', 'runner']
const MANAGE_ROLES = ['admin', 'sales', 'operations', 'management']

type ProductRel = { name?: string | null; sku?: string | null; image_url?: string | null }
type NameRel = { name?: string | null; full_name?: string | null }

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; received?: string; returned?: string; sent?: string }>
}) {
  const profile = await requireStaff()
  const supabase = await createClient()
  const params = await searchParams
  const showCost = canSeeCosts(profile.role)
  const canManage = MANAGE_ROLES.includes(profile.role)

  const movementSelect =
    'id, product_id, quantity, from_holder, to_holder, company_id, holder_profile_id, note, created_at, created_by, product:products(name), company:companies(name)'
  const [stockResult, movementResult, companyResult, teamResult, productResult] = await Promise.all([
    supabase.from('sample_stock').select('id, product_id, in_office, with_team, with_client, pending_supplier, unit_cost, product:products(name, sku, image_url)'),
    supabase.from('sample_movements').select(movementSelect).order('created_at', { ascending: false }).limit(40),
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).in('role', TEAM_ROLES).order('full_name'),
    supabase.from('products').select('id, name, sku').eq('status', 'active').order('name').limit(1000),
  ])

  let movementsRaw: unknown[] = movementResult.data || []
  let movementError = movementResult.error?.message || ''
  if (movementResult.error && /holder_profile_id/i.test(movementResult.error.message)) {
    const retry = await supabase
      .from('sample_movements')
      .select('id, product_id, quantity, from_holder, to_holder, company_id, note, created_at, created_by, product:products(name), company:companies(name)')
      .order('created_at', { ascending: false })
      .limit(40)
    movementsRaw = retry.data || []
    movementError = retry.error?.message || ''
  }

  const balances = await supabase
    .from('sample_balances')
    .select('product_id, company_id, profile_id, quantity, company:companies(name), profile:profiles(full_name)')
    .gt('quantity', 0)
  const balanceHint = balances.error
    ? /sample_balances/i.test(balances.error.message)
      ? 'Per-client balances need supabase/migrations/20261027_samples_internal.sql before Receive into Office can square a client off.'
      : balances.error.message
    : ''

  const actorIds = new Set<string>()
  for (const row of movementsRaw) {
    const record = row as { created_by?: string | null; holder_profile_id?: string | null }
    if (record.created_by) actorIds.add(record.created_by)
    if (record.holder_profile_id) actorIds.add(record.holder_profile_id)
  }
  const names = new Map<string, string>()
  if (actorIds.size) {
    const { data: actors } = await supabase.from('profiles').select('id, full_name').in('id', [...actorIds])
    for (const actor of actors || []) names.set(actor.id, actor.full_name || 'Team member')
  }

  const companiesByProduct = new Map<string, SampleCard['companies']>()
  const teamByProduct = new Map<string, SampleCard['team']>()
  for (const row of balances.data || []) {
    const record = row as {
      product_id: string
      company_id: string | null
      profile_id: string | null
      quantity: number
      company?: NameRel | NameRel[] | null
      profile?: NameRel | NameRel[] | null
    }
    if (record.company_id) {
      const list = companiesByProduct.get(record.product_id) || []
      list.push({
        id: record.company_id,
        name: oneRelation(record.company)?.name || 'Client',
        quantity: Number(record.quantity || 0),
      })
      companiesByProduct.set(record.product_id, list)
    }
    if (record.profile_id) {
      const list = teamByProduct.get(record.product_id) || []
      list.push({
        id: record.profile_id,
        name: oneRelation(record.profile)?.full_name || names.get(record.profile_id) || 'Team member',
        quantity: Number(record.quantity || 0),
      })
      teamByProduct.set(record.product_id, list)
    }
  }

  const samples: SampleCard[] = (stockResult.data || []).map((row) => {
    const record = row as {
      id: string
      product_id: string
      in_office: number | null
      with_team: number | null
      with_client: number | null
      pending_supplier: number | null
      unit_cost: number | null
      product?: ProductRel | ProductRel[] | null
    }
    const product = oneRelation(record.product)
    return {
      id: record.id,
      productId: record.product_id,
      name: product?.name || 'Product',
      sku: product?.sku || '',
      imageUrl: product?.image_url || null,
      inOffice: Number(record.in_office || 0),
      withTeam: Number(record.with_team || 0),
      withClient: Number(record.with_client || 0),
      pendingSupplier: Number(record.pending_supplier || 0),
      unitCost: record.unit_cost,
      companies: (companiesByProduct.get(record.product_id) || []).sort((a, b) => a.name.localeCompare(b.name)),
      team: (teamByProduct.get(record.product_id) || []).sort((a, b) => a.name.localeCompare(b.name)),
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  const movements: SampleMovement[] = movementsRaw.map((row) => {
    const record = row as {
      id: string
      product_id: string
      quantity: number
      from_holder: string
      to_holder: string
      note: string | null
      created_at: string
      created_by?: string | null
      holder_profile_id?: string | null
      product?: ProductRel | ProductRel[] | null
      company?: NameRel | NameRel[] | null
    }
    return {
      id: record.id,
      at: record.created_at,
      productId: record.product_id,
      productName: oneRelation(record.product)?.name || 'Product',
      quantity: Number(record.quantity || 0),
      from: record.from_holder,
      to: record.to_holder,
      companyName: oneRelation(record.company)?.name || null,
      holderName: record.holder_profile_id ? names.get(record.holder_profile_id) || null : null,
      actorName: record.created_by ? names.get(record.created_by) || null : null,
      note: record.note,
    }
  })

  const companies: NamedOption[] = (companyResult.data || []).map((company) => ({ id: company.id, name: company.name }))
  const team: NamedOption[] = (teamResult.data || []).map((member) => ({ id: member.id, name: member.full_name || 'Team member' }))
  const products: NamedOption[] = (productResult.data || []).map((product) => ({ id: product.id, name: product.name, sku: product.sku }))

  const notice =
    params.returned === 'client'
      ? 'Sample received into the office. That client balance is squared off.'
      : params.returned === 'team'
        ? 'Sample returned from the team into the office.'
        : params.sent === '1'
          ? 'Sample sent. The movement is recorded.'
          : params.received === '1'
            ? 'Sample received from the supplier into office stock.'
            : ''

  return (
    <div className="space-y-4">
      {params.error ? <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{params.error}</div> : null}
      {movementError ? <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{movementError}</div> : null}
      {stockResult.error ? <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{stockResult.error.message}</div> : null}
      {notice ? <div className="border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div> : null}
      <SamplesBoard
        samples={samples}
        movements={movements}
        companies={companies}
        team={team}
        products={products}
        canManage={canManage}
        showCost={showCost}
        balanceHint={balanceHint}
      />
    </div>
  )
}
