import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDateTime, oneRelation } from '@/lib/utils'
import { requireStaff, canSeeCosts } from '@/lib/auth'
import { canManageSamples, deriveClientHoldings, HOLDER_LABEL, SAMPLE_VIEW_ROLES } from '@/lib/samples/ledger'
import { sampleSchemaMissing } from '@/lib/samples/opening-stock'
import { SamplesBoard, type MovementModel, type SampleCardModel } from './samples-board'

const MOVEMENT_BASE =
  'id, product_id, quantity, from_holder, to_holder, company_id, note, created_by, created_at, product:products(name), company:companies(name)'

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; received?: string; moved?: string; returned?: string; sent?: string }>
}) {
  const profile = await requireStaff()
  const supabase = await createClient()
  const showCost = canSeeCosts(profile.role)
  const params = await searchParams

  const [stockResult, movementExtended, productsResult, companiesResult, peopleResult] = await Promise.all([
    supabase.from('sample_stock').select('id, product_id, in_office, with_team, with_client, pending_supplier, unit_cost, product:products(name, sku, image_url)'),
    supabase
      .from('sample_movements')
      .select(`${MOVEMENT_BASE}, holder_profile_id, condition`)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase.from('products').select('id, name, sku').eq('status', 'active').order('name').limit(200),
    supabase.from('companies').select('id, name').order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active')
      .in('role', [...SAMPLE_VIEW_ROLES])
      .order('full_name'),
  ])

  const movementResult =
    movementExtended.error && /holder_profile_id|condition/i.test(movementExtended.error.message)
      ? await supabase.from('sample_movements').select(MOVEMENT_BASE).order('created_at', { ascending: false }).limit(80)
      : movementExtended

  const holdingResult = await supabase.from('sample_holdings').select('product_id, company_id, profile_id, quantity')
  const holdingsReady = !holdingResult.error
  const holdingRows = holdingsReady ? holdingResult.data || [] : []

  const people = peopleResult.data || []
  const personName = new Map(people.map((person) => [person.id, person.full_name || person.email || 'Team member']))
  const companies = companiesResult.data || []
  const companyName = new Map(companies.map((company) => [company.id, company.name]))

  const movementRows = (movementResult.data || []).map((row) => {
    const record = row as Record<string, unknown>
    const product = oneRelation(record.product as { name?: string } | { name?: string }[] | null)
    const company = oneRelation(record.company as { name?: string } | { name?: string }[] | null)
    const holderProfileId = typeof record.holder_profile_id === 'string' ? record.holder_profile_id : null
    const companyId = typeof record.company_id === 'string' ? record.company_id : null
    return {
      id: String(record.id),
      productId: String(record.product_id),
      productName: product?.name || 'Product',
      companyId,
      companyName: company?.name || (companyId ? companyName.get(companyId) || null : null),
      quantity: Number(record.quantity) || 0,
      from: String(record.from_holder || ''),
      to: String(record.to_holder || ''),
      holderProfileId,
      actorId: typeof record.created_by === 'string' ? record.created_by : null,
      condition: typeof record.condition === 'string' ? record.condition : null,
      note: typeof record.note === 'string' ? record.note : null,
      createdAt: typeof record.created_at === 'string' ? record.created_at : null,
    }
  })

  const derivedClients = holdingsReady
    ? []
    : deriveClientHoldings(
        movementRows.map((row) => ({
          product_id: row.productId,
          company_id: row.companyId,
          company_name: row.companyName,
          quantity: row.quantity,
          from_holder: row.from,
          to_holder: row.to,
        })),
      )

  const cards: SampleCardModel[] = (stockResult.data || []).map((row) => {
    const product = oneRelation(row.product as { name?: string; sku?: string; image_url?: string | null } | { name?: string; sku?: string; image_url?: string | null }[] | null)
    const clients = holdingsReady
      ? holdingRows
          .filter((holding) => holding.product_id === row.product_id && holding.company_id && Number(holding.quantity) > 0)
          .map((holding) => ({
            id: holding.company_id as string,
            name: companyName.get(holding.company_id as string) || 'Client',
            quantity: Number(holding.quantity) || 0,
          }))
      : derivedClients
          .filter((holding) => holding.productId === row.product_id)
          .map((holding) => ({ id: holding.companyId, name: holding.name, quantity: holding.quantity }))
    const team = holdingsReady
      ? holdingRows
          .filter((holding) => holding.product_id === row.product_id && holding.profile_id && Number(holding.quantity) > 0)
          .map((holding) => ({
            id: holding.profile_id as string,
            name: personName.get(holding.profile_id as string) || 'Team member',
            quantity: Number(holding.quantity) || 0,
          }))
      : []
    const name = product?.name || 'Product'
    const sku = product?.sku || ''
    return {
      id: row.id,
      productId: row.product_id,
      name,
      sku,
      imageUrl: product?.image_url || null,
      inOffice: Number(row.in_office) || 0,
      withTeam: Number(row.with_team) || 0,
      withClient: Number(row.with_client) || 0,
      pendingSupplier: Number(row.pending_supplier) || 0,
      unitCostLabel: showCost ? formatCurrency(row.unit_cost) : null,
      holders: [...clients.map((client) => client.name), ...team.map((member) => member.name)],
      clients,
      team,
    }
  })

  cards.sort((a, b) => a.name.localeCompare(b.name))

  const movements: MovementModel[] = movementRows.map((row) => {
    const who = [row.companyName, row.holderProfileId ? personName.get(row.holderProfileId) || 'Team member' : null]
      .filter(Boolean)
      .join(' · ') || null
    return {
      id: row.id,
      productId: row.productId,
      productName: row.productName,
      quantity: row.quantity,
      fromLabel: HOLDER_LABEL[row.from] || row.from,
      toLabel: HOLDER_LABEL[row.to] || row.to,
      who,
      actor: row.actorId ? personName.get(row.actorId) || 'Staff' : null,
      condition: row.condition,
      note: row.note,
      when: formatDateTime(row.createdAt),
    }
  })

  const loadError = [stockResult.error, movementResult.error, holdingResult.error]
    .map((error) => error?.message || '')
    .find((message) => message && !sampleSchemaMissing(message))

  return (
    <SamplesBoard
      cards={cards}
      movements={movements}
      products={(productsResult.data || []).map((product) => ({ id: product.id, name: product.name, sku: product.sku }))}
      companies={companies.map((company) => ({ id: company.id, name: company.name }))}
      team={people
        .filter((person) => person.is_active)
        .map((person) => ({ id: person.id, name: person.full_name || person.email || 'Team member' }))}
      canManage={canManageSamples(profile.role)}
      showCost={showCost}
      notice={params.error || loadError || ''}
      received={params.received === '1'}
      moved={params.moved === '1'}
      returned={params.returned === '1'}
      sent={params.sent === '1'}
    />
  )
}
