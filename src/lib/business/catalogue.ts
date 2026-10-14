import 'server-only'

import { getPublicCatalogueProducts, type PublicProduct } from '@/lib/catalogue/products'
import { minimumOrderQty } from '@/lib/business/lines'
import { getCompanyMarginPercent, sellPricesForSurface } from '@/lib/pricing/server'

export type BusinessProduct = PublicProduct & {
  indicativePrice: number | null
  moqUnits: number
}

export async function getBusinessCatalogue(companyId: string | null): Promise<BusinessProduct[]> {
  const products = await getPublicCatalogueProducts()
  const margin = companyId ? await getCompanyMarginPercent(companyId) : null
  const prices = await sellPricesForSurface(
    products.map((product) => product.id),
    'business',
    margin,
    companyId,
  )
  return products.map((product) => ({
    ...product,
    indicativePrice: prices?.get(product.id) ?? null,
    moqUnits: minimumOrderQty(product.moq),
  }))
}

export async function getBusinessProduct(companyId: string | null, id: string) {
  const products = await getBusinessCatalogue(companyId)
  return products.find((product) => product.id === id) || null
}
