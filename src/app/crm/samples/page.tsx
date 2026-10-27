import { createClient } from '@/lib/supabase/server'
import { formatDateTime, oneRelation } from '@/lib/utils'
import { requireStaff, canSeeCosts } from '@/lib/auth'
import { SamplesBoard, type MovementLine, type NamedOption, type SampleCard } from './samples-board'

const WRITE_ROLES = new Set(['admin', 'sales', 'operations'])
const HOLDER_LABEL: Record<string, string> = {
  office: 'Office',
  team: 'Team',
  client: 'Client',
  supplier: 'Supplier',
}

type EmbedName = { name?: string | null; sku?: string | null; image_url?: string | null; full_name?: string | null }

function labelOf(value: string | null | undefined) {
  if (!value) return 'Unknown'
  return HOLDER_LABEL[value] || value
}

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; received?: string; moved?: string; sent?: string; returned?: string }>
}) {
  const profile = await requireStaff()
  const supabase = await createClient()
  const showCost = canSeeCosts(profile.role)
  const params = await searchParams
  const error = params.error || ''
  const notice = params.returned === '1'
    ? 'Sample received into the office. The holder balance is updated.'
    : params.sent === '1'
      ? 'Sample send recorded.'
      : params.received === '1'
        ? 'Sample received from the supplier into office stock.'
        : params.moved === '1'
          ? 'Sample movement recorded.'
          : null

  const [samplesResult, movementsResult, balancesResult, companiesResult, teamResult, catalogueResult] = await Promise.all([
    supabase.from('sample_stock').select('*, product:products(name, sku, image_url)'),
    supabase
      .from('sample_movements')
      .select('id, product_id, quantity, from_holder, to_holder, company_id, holder_profile_id, note, created_by, created_at, product:products(name), company:companies(name)')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('sample_holder_balances').select('product_id, company_id, holder_profile_id, quantity').gt('quantity', 0),
    supabase.from('companies').select('id, name').order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .in('role', ['admin', 'sales', 'operations', 'accounts', 'management', 'runner'])
      .order('full_name'),
    supabase.from('products').select('id, name, sku').eq('status', 'active').order('name'),
  ])

  let movements = (movementsResult.data || []) as Array<Record<string, unknown>>
  let movementError = movementsResult.error
  if (movementError && /holder_profile_id/i.test(movementError.message)) {
    const retry = await supabase
      .from('sample_movements')
      .select('id, product_id, quantity, from_holder, to_holder, company_id, note, created_by, created_at, product:products(name), company:companies(name)')
      .order('created_at', { ascending: false })
      .limit(40)
    movements = (retry.data || []) as Array<Record<string, unknown>>
    movementError = retry.error
  }

  let balanceWarning: string | null = null
  let balances = balancesResult.data || []
  if (balancesResult.error) {
    balances = []
    balanceWarning = /sample_holder_balances|schema cache|does not exist/i.test(balancesResult.error.message)
      ? 'Who holds each sample needs supabase/migrations/20261027_samples_internal.sql before Receive into Office can square a client off.'
      : balancesResult.error.message
  }
  if (samplesResult.error) balanceWarning = samplesResult.error.message
  if (movementError && !balanceWarning) balanceWarning = movementError.message

  const actorIds = [...new Set(movements.map((row) => String(row.created_by || '')).filter(Boolean))]
  const { data: actors } = actorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] as { id: string; full_name: string | null }[] }
  const actorName = new Map((actors || []).map((row) => [row.id, row.full_name || 'Staff']))
  const companyName = new Map((companiesResult.data || []).map((row) => [row.id, row.name]))
  const teamName = new Map((teamResult.data || []).map((row) => [row.id, row.full_name || 'Team member']))

  for (const balance of balances) {
    if (balance.holder_profile_id && !teamName.has(balance.holder_profile_id)) {
      teamName.set(balance.holder_profile_id, 'Team member')
    }
  }

  const cards: SampleCard[] = (samplesResult.data || []).map((sample) => {
    const product = oneRelation(sample.product as EmbedName | EmbedName[] | null)
    const clients = balances
      .filter((row) => row.product_id === sample.product_id && row.company_id)
      .map((row) => ({
        id: row.company_id as string,
        name: companyName.get(row.company_id as string) || 'Client',
        quantity: Number(row.quantity || 0),
      }))
    const teamHolders = balances
      .filter((row) => row.product_id === sample.product_id && row.holder_profile_id)
      .map((row) => ({
        id: row.holder_profile_id as string,
        name: teamName.get(row.holder_profile_id as string) || 'Team member',
        quantity: Number(row.quantity || 0),
      }))
    return {
      stockId: sample.id,
      productId: sample.product_id,
      name: product?.name || 'Product',
      sku: product?.sku || '',
      imageUrl: product?.image_url || null,
      inOffice: Number(sample.in_office || 0),
      withTeam: Number(sample.with_team || 0),
      withClient: Number(sample.with_client || 0),
      pendingSupplier: Number(sample.pending_supplier || 0),
      unitCost: sample.unit_cost == null ? null : Number(sample.unit_cost),
      clients,
      team: teamHolders,
    }
  }).sort((a, b) => a.name.localeCompare(b.name) || a.sku.localeCompare(b.sku))

  const history: MovementLine[] = movements.map((row) => {
    const product = oneRelation(row.product as EmbedName | EmbedName[] | null)
    const company = oneRelation(row.company as EmbedName | EmbedName[] | null)
    const holderId = typeof row.holder_profile_id === 'string' ? row.holder_profile_id : null
    const companyId = typeof row.company_id === 'string' ? row.company_id : null
    const who = company?.name || (companyId ? companyName.get(companyId) : null) || (holderId ? teamName.get(holderId) : null) || null
    const createdBy = typeof row.created_by === 'string' ? row.created_by : null
    return {
      id: String(row.id),
      when: formatDateTime(typeof row.created_at === 'string' ? row.created_at : null),
      productName: product?.name || 'Product',
      quantity: Number(row.quantity || 0),
      from: labelOf(typeof row.from_holder === 'string' ? row.from_holder : null),
      to: labelOf(typeof row.to_holder === 'string' ? row.to_holder : null),
      who,
      actor: createdBy ? actorName.get(createdBy) || null : null,
      note: typeof row.note === 'string' ? row.note : null,
    }
  })

  const companies: NamedOption[] = (companiesResult.data || []).map((row) => ({ id: row.id, name: row.name }))
  const team: NamedOption[] = (teamResult.data || []).map((row) => ({ id: row.id, name: row.full_name || 'Team member' }))
  const catalogue: NamedOption[] = (catalogueResult.data || []).map((row) => ({
    id: row.id,
    name: row.sku ? `${row.name} · ${row.sku}` : row.name,
  }))

  return (
    <SamplesBoard
      cards={cards}
      movements={history}
      companies={companies}
      team={team}
      catalogue={catalogue}
      canMove={WRITE_ROLES.has(profile.role)}
      showCost={showCost}
      notice={notice}
      error={error || null}
      balanceWarning={balanceWarning}
    />
  )
}
