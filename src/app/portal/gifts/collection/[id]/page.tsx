import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { isUuid } from '@/lib/utils'
import { PACK_OPTION_LABELS } from '@/lib/catalogue/budget-packs'
import { withCompanyPrices } from '@/lib/catalogs/pricing'
import { withVisibleKitTotals } from '@/lib/catalogs/visibility'
import { displayableLineIds } from '@/lib/catalogs/visibility-data'
import { formatCurrency } from '@/lib/utils'
import { CatalogQuoteBoard, type CatalogQuoteItem } from '@/components/portal/catalog-quote-board'
import { Package } from 'lucide-react'

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')

  const offeringQuery = () =>
    supabase
      .from('campaign_products')
      .select('id, product_id, display_name, client_description, client_image_url, selling_price, pack_kit_total, moq, display_order, pack_option, pack_kit_id, pack_kit_role, campaign_id, campaign:campaigns(id, name, company_id, budget_per_employee), product:products!inner(status, sku)')
      .eq('visibility', 'published')
      .eq('campaign_id', id)
      .eq('product.status', 'active')
      .order('display_order')

  const offeringsResult = await offeringQuery()
  const storedOfferings = offeringsResult.data || []
  const pricedOfferings = await withCompanyPrices(storedOfferings, companyId)
  const visibleIds = companyId ? await displayableLineIds(id, { kind: 'company', companyId }) : null
  const offerings = withVisibleKitTotals(
    visibleIds ? pricedOfferings.filter((offering) => visibleIds.has(offering.id)) : pricedOfferings,
  )

  const [{ data: selections }, { data: campaignMeta }] = await Promise.all([
    supabase.from('client_product_selections').select('campaign_product_id, kind').eq('company_id', companyId),
    supabase.from('campaigns').select('name, budget_per_employee').eq('id', id).maybeSingle(),
  ])

  if (!campaignMeta) notFound()

  const selectionByOffering = new Map(
    (selections || []).map((row: { campaign_product_id: string; kind: string }) => [row.campaign_product_id, row.kind]),
  )

  type Offering = (typeof offerings)[number]
  const packPrimaries = offerings.filter(
    (row) =>
      (row.pack_option === 'A' || row.pack_option === 'B' || row.pack_option === 'C') &&
      row.pack_kit_role !== 'line',
  )
  const otherRows = offerings.filter((row) => !row.pack_option)
  const kitLinesById = new Map<string, Offering[]>()
  for (const row of offerings) {
    if (!row.pack_kit_id) continue
    const list = kitLinesById.get(row.pack_kit_id) || []
    list.push(row)
    kitLinesById.set(row.pack_kit_id, list)
  }

  const toItem = (offering: Offering, kitMembers: Offering[] = []): CatalogQuoteItem => {
    const kitLines = kitMembers
      .filter((line) => line.id !== offering.id)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    const kitItemRows = [offering, ...kitLines]
    const rawPrice = offering.pack_kit_total != null ? Number(offering.pack_kit_total) : offering.selling_price
    const price = rawPrice == null || !Number.isFinite(Number(rawPrice)) ? null : Number(rawPrice)
    const campaign = Array.isArray(offering.campaign) ? offering.campaign[0] : offering.campaign
    const packKey = offering.pack_option as 'A' | 'B' | 'C' | null
    const kind = selectionByOffering.get(offering.id) || null
    return {
      id: offering.id,
      name: offering.display_name || 'Gift',
      description: offering.client_description || '',
      imageUrl: offering.client_image_url,
      price,
      moq: offering.moq && offering.moq > 0 ? offering.moq : 1,
      campaignId: offering.campaign_id,
      shortlisted: kind === 'shortlisted' || kind === 'selected',
      eyebrow: packKey ? PACK_OPTION_LABELS[packKey] : campaign?.name || null,
      includes: kitItemRows.length > 1 ? kitItemRows.map((line) => line.display_name || 'Gift') : [],
    }
  }

  const groups: { title?: string; items: CatalogQuoteItem[] }[] = []
  if (packPrimaries.length > 0) {
    const items = (['A', 'B', 'C'] as const).flatMap((opt) => {
      const row = packPrimaries.find((offering) => offering.pack_option === opt)
      if (!row) return []
      const members = row.pack_kit_id ? kitLinesById.get(row.pack_kit_id) || [] : []
      return [toItem(row, members)]
    })
    if (items.length) groups.push({ title: 'Budget options', items })
  }
  if (otherRows.length > 0) {
    groups.push({
      title: packPrimaries.length > 0 ? 'Other gifts' : undefined,
      items: otherRows.map((row) => toItem(row)),
    })
  }

  const budget = campaignMeta.budget_per_employee != null && Number(campaignMeta.budget_per_employee) > 0
    ? Number(campaignMeta.budget_per_employee)
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{campaignMeta.name || 'Collection'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add the gifts you need, set a quantity for each, and request one quote.
        </p>
        {budget != null && (
          <p className="mt-1 text-xs text-gray-500">Budget: {formatCurrency(budget)} per person</p>
        )}
      </div>
      {groups.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-semibold text-gray-700">Nothing to review just yet</p>
          <p className="mt-1 text-xs text-gray-400">Your account manager will share gifts for this collection shortly.</p>
        </div>
      ) : (
        <CatalogQuoteBoard catalogId={id} budget={budget} groups={groups} />
      )}
    </div>
  )
}
