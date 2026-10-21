import { NextResponse } from 'next/server'
import { canSeeCosts, canViewPricing, getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function cell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET() {
  const profile = await getProfile()
  if (!profile || !canViewPricing(profile.role)) {
    return new NextResponse('Not allowed', { status: 403 })
  }
  const showCost = canSeeCosts(profile.role)
  const supabase = await createClient()
  const [{ data: products }, fixed] = await Promise.all([
    supabase.from('products').select('id, sku, name, price, product_costs(supplier_cost)').eq('status', 'active').order('sku').limit(2000),
    supabase.from('portal_product_prices').select('product_id, portal, price'),
  ])
  const fixedPrice = new Map<string, string>()
  for (const row of fixed.data || []) fixedPrice.set(`${row.product_id}:${row.portal}`, row.price == null ? '' : String(row.price))
  const headers = ['sku', 'name', ...(showCost ? ['cost_price'] : []), 'retail_price', 'store_fixed_price', 'business_fixed_price', 'corporate_fixed_price']
  const lines = [headers.join(',')]
  for (const product of products || []) {
    const costRelation = product.product_costs as { supplier_cost?: number | null } | { supplier_cost?: number | null }[] | null
    const cost = Array.isArray(costRelation) ? costRelation[0]?.supplier_cost : costRelation?.supplier_cost
    const values = [
      product.sku || '',
      product.name || '',
      ...(showCost ? [cost == null ? '' : String(cost)] : []),
      product.price == null ? '' : String(product.price),
      fixedPrice.get(`${product.id}:store`) || '',
      fixedPrice.get(`${product.id}:business`) || '',
      fixedPrice.get(`${product.id}:corporate`) || '',
    ]
    lines.push(values.map((value) => cell(String(value))).join(','))
  }
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="pricing.csv"',
    },
  })
}
