import 'server-only'

import { getPublicCatalogueProducts, type PublicProduct } from '@/lib/catalogue/products'
import { minimumOrderQty } from '@/lib/business/lines'
import { gstPriceNote } from '@/lib/pricing/engine'
import { getPricingSettings, sellPricesForSurface } from '@/lib/pricing/server'
import { createClient } from '@/lib/supabase/server'

export type BusinessProduct = PublicProduct & {
  indicativePrice: number | null
  moqUnits: number
}

async function approvedBusinessMargin(companyId: string | null) {
  if (!companyId) return { show: false, margin: null as number | null }
  const supabase = await createClient()
  const { data } = await supabase
    .from('companies')
    .select('margin_percent, business_verification, account_type')
    .eq('id', companyId)
    .maybeSingle()
  const business = (data?.account_type || '') === 'business'
  const show = business ? data?.business_verification === 'verified' : Boolean(data)
  const margin = data?.margin_percent == null ? null : Number(data.margin_percent)
  return { show, margin: margin != null && Number.isFinite(margin) ? margin : null }
}

export async function getBusinessCatalogue(companyId: string | null): Promise<BusinessProduct[]> {
  const products = await getPublicCatalogueProducts()
  const pricing = await approvedBusinessMargin(companyId)
  const settings = await getPricingSettings()
  const prices = pricing.show
    ? await sellPricesForSurface(
      products.map((product) => product.id),
      'business',
      pricing.margin,
      companyId,
    )
    : null
  const note = gstPriceNote(settings.portals.business.gstMode)
  return products.map((product) => {
    const indicativePrice = prices?.get(product.id) ?? null
    return {
      ...product,
      price: indicativePrice,
      priceNote: indicativePrice == null ? null : note,
      indicativePrice,
      moqUnits: minimumOrderQty(product.moq),
    }
  })
}

export async function getBusinessProduct(companyId: string | null, id: string) {
  const products = await getBusinessCatalogue(companyId)
  return products.find((product) => product.id === id) || null
}
