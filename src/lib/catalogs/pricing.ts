import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveSellPrice } from '@/lib/pricing/resolve'
import { offersByProduct } from '@/lib/pricing/offers'
import { getPricingSettings, loadSupplierOffers, supplierCostForProduct } from '@/lib/pricing/server'
import { companyCanUseCatalog } from '@/lib/catalogs/rfq'

/**
 * Per-company catalog prices.
 *
 * One catalog can be assigned to many companies, so a catalog line has no single sell price.
 * What a company sees is resolved at read time:
 *   1. campaign_products.manual_price (explicit override, same for every company), else
 *   2. pack / kit rows keep their stored price (the pack was composed against one company's prices;
 *      see campaign_products.priced_company_id), else
 *   3. product cost (best supplier offer when the portal surface uses it) or list price,
 *      with THAT company's margin (company -> channel -> product -> global, see resolveMarginPercent).
 * campaign_products.selling_price stays as the default snapshot used when nothing else can be computed.
 * Mirrors public.place_direct_order for the catalog surface so the price shown is the price charged.
 */

type OfferingRow = {
  id: string
  product_id: string
  selling_price: number | null
  manual_price: number | null
  pack_option: string | null
  pack_kit_id: string | null
}

const BASE_COLUMNS = 'id, product_id, selling_price, pack_option, pack_kit_id'

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function loadOfferings(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  scope: { ids: string[] } | { campaignId: string },
): Promise<OfferingRow[]> {
  const run = async (columns: string) => {
    const query = admin.from('campaign_products').select(columns)
    return 'ids' in scope ? query.in('id', scope.ids) : query.eq('campaign_id', scope.campaignId)
  }
  let result = await run(`${BASE_COLUMNS}, manual_price`)
  // manual_price arrives with migration 20261009; before it, nothing is overridden.
  if (result.error && /manual_price/i.test(result.error.message)) result = await run(BASE_COLUMNS)
  if (result.error || !result.data) return []
  return (result.data as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    product_id: String(row.product_id),
    selling_price: num(row.selling_price),
    manual_price: num(row.manual_price),
    pack_option: (row.pack_option as string | null) ?? null,
    pack_kit_id: (row.pack_kit_id as string | null) ?? null,
  }))
}

async function priceRows(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  rows: OfferingRow[],
  companyId: string | null,
): Promise<Map<string, number | null>> {
  const prices = new Map<string, number | null>()
  const computeIds: string[] = []
  for (const row of rows) {
    if (row.manual_price != null) prices.set(row.id, row.manual_price)
    else if (row.pack_option || row.pack_kit_id) prices.set(row.id, row.selling_price)
    else {
      prices.set(row.id, row.selling_price)
      computeIds.push(row.id)
    }
  }
  if (!computeIds.length) return prices

  const productIds = [...new Set(rows.filter((row) => computeIds.includes(row.id)).map((row) => row.product_id))]
  const settings = await getPricingSettings()
  const [{ data: products }, companyResult] = await Promise.all([
    admin.from('products').select('id, price, supplier_cost, internal_margin, moq').in('id', productIds),
    companyId
      ? admin.from('companies').select('margin_percent').eq('id', companyId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (!products) return prices
  const companyMargin = num((companyResult.data as { margin_percent?: unknown } | null)?.margin_percent)
  const flags = settings.surfaces.portal
  const grouped = flags.useBestCost ? offersByProduct(await loadSupplierOffers(admin, productIds)) : new Map()
  const byProduct = new Map(products.map((product) => [product.id as string, product]))

  for (const row of rows) {
    if (!computeIds.includes(row.id)) continue
    const product = byProduct.get(row.product_id)
    if (!product) continue
    const cost = supplierCostForProduct(product, grouped.get(product.id) || [], {
      useBestCost: flags.useBestCost,
      requireInStock: settings.requireInStock,
      quantity: product.moq,
    })
    prices.set(
      row.id,
      resolveSellPrice({
        supplierCost: cost,
        listPrice: product.price,
        productMarginPercent: product.internal_margin,
        companyMarginPercent: companyMargin,
        channel: 'b2b',
        settings,
      }).sellPrice,
    )
  }
  return prices
}

/** Sell price per catalog line id for one viewing company. Empty map when the service client is unavailable. */
export async function offeringPricesForCompany(
  offeringIds: string[],
  companyId: string | null | undefined,
): Promise<Map<string, number | null>> {
  const admin = createAdminClient()
  if (!admin || !offeringIds.length) return new Map()
  const rows = await loadOfferings(admin, { ids: [...new Set(offeringIds)] })
  return priceRows(admin, rows, companyId ?? null)
}

/** Replace `selling_price` on already-loaded lines with the viewing company's price. */
export async function withCompanyPrices<T extends { id: string; selling_price: number | null }>(
  lines: T[],
  companyId: string | null | undefined,
): Promise<T[]> {
  if (!lines.length) return lines
  const prices = await offeringPricesForCompany(lines.map((line) => line.id), companyId)
  if (!prices.size) return lines
  return lines.map((line) => {
    const price = prices.get(line.id)
    return price === undefined ? line : { ...line, selling_price: price }
  })
}

/** Price per product_id for one catalog and company (used by RFQ -> quotation). Plain lines only. */
export async function catalogProductPricesForCompany(
  campaignId: string,
  companyId: string | null | undefined,
): Promise<Map<string, number>> {
  const admin = createAdminClient()
  const out = new Map<string, number>()
  if (!admin) return out
  const rows = await loadOfferings(admin, { campaignId })
  const prices = await priceRows(admin, rows, companyId ?? null)
  for (const row of rows) {
    const price = prices.get(row.id)
    if (price != null) out.set(row.product_id, price)
  }
  return out
}

/** Company whose margin prices new lines and previews: campaigns.company_id, else the first assignment. */
export async function defaultCatalogCompanyId(campaignId: string): Promise<string | null> {
  const admin = createAdminClient()
  if (!admin) return null
  const { data: campaign } = await admin.from('campaigns').select('company_id').eq('id', campaignId).maybeSingle()
  if (campaign?.company_id) return campaign.company_id as string
  const { data: assignment } = await admin
    .from('catalog_assignments')
    .select('company_id')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (assignment?.company_id as string | undefined) ?? null
}

/**
 * Company whose margin prices a share-link page. A signed-in client sees what they would be charged
 * (their own company, if the catalog is assigned to it); otherwise the company the link was generated
 * for (catalog_share_links.company_id); otherwise the catalog default.
 */
export async function sharePricingCompanyId(
  token: string,
  campaignId: string,
  viewerCompanyId: string | null | undefined,
): Promise<string | null> {
  const admin = createAdminClient()
  if (!admin) return null
  if (viewerCompanyId && (await companyCanUseCatalog(admin, campaignId, viewerCompanyId))) return viewerCompanyId
  // company_id arrives with migration 20261009; an error just means "no scoped company".
  const { data } = await admin.from('catalog_share_links').select('company_id').eq('token', token).maybeSingle()
  const scoped = (data as { company_id?: string | null } | null)?.company_id
  if (scoped) return scoped
  return defaultCatalogCompanyId(campaignId)
}
