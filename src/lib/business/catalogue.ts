import 'server-only'

import { getBusinessAccess } from '@/lib/business/access'
import { presentBusinessProduct } from '@/lib/business/access-state'
import { getPublicCatalogueProducts, type PublicProduct } from '@/lib/catalogue/products'
import { gstPriceNote } from '@/lib/pricing/engine'
import { getPricingSettings, sellPricesForSurface } from '@/lib/pricing/server'

function finiteMargin(value: number | null | undefined) {
  if (value == null) return null
  const margin = Number(value)
  return Number.isFinite(margin) ? margin : null
}

export type BusinessProduct = PublicProduct & {
  indicativePrice: number | null
  moqUnits: number
}

export async function getBusinessCatalogue(companyId: string | null): Promise<BusinessProduct[]> {
  const access = await getBusinessAccess()
  const showPrices = access.canSeePrices && (!companyId || access.company?.id === companyId)
  const products = await getPublicCatalogueProducts('business')
  const settings = await getPricingSettings()
  const margin = showPrices ? finiteMargin(access.company?.margin_percent) : null
  const prices = showPrices
    ? await sellPricesForSurface(
      products.map((product) => product.id),
      'business',
      margin,
      companyId || access.company?.id || null,
    )
    : null
  const note = gstPriceNote(settings.portals.business.gstMode)
  return products.map((product) => presentBusinessProduct(
    product,
    prices?.get(product.id) ?? null,
    note,
    showPrices,
  ))
}

export async function getBusinessProduct(companyId: string | null, id: string) {
  const products = await getBusinessCatalogue(companyId)
  return products.find((product) => product.id === id) || null
}
