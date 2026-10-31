'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { withIdempotency } from '@/lib/idempotency'
import { DIRECT_ORDER_ROLES, parseDirectOrderPrices } from '@/lib/orders/direct-order'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'

export async function createOrderFromRequirement(formData: FormData) {
  return withIdempotency('crm.createOrderFromRequirement', formData, () => createOrderFromRequirementOnce(formData))
}

async function createOrderFromRequirementOnce(formData: FormData) {
  const profile = await getProfile()
  if (!profile || !profile.is_active) return { error: 'Not authenticated' }
  if (!DIRECT_ORDER_ROLES.includes(profile.role as (typeof DIRECT_ORDER_ROLES)[number])) {
    return { error: 'Not permitted to create an order' }
  }

  const requirementId = String(formData.get('requirement_id') || '')
  if (!isUuid(requirementId)) return { error: 'Requirement is required' }

  const supabase = await createClient()
  const { data: requirement, error: requirementError } = await supabase
    .from('requirements')
    .select('id, company_id, quantity')
    .eq('id', requirementId)
    .maybeSingle()
  if (requirementError) return { error: requirementError.message }
  if (!requirement?.company_id) return { error: 'Requirement not found' }

  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('requirement_id', requirementId)
    .limit(1)
    .maybeSingle()
  if (existingOrder?.id) return { error: 'This requirement already has an order' }

  const { data: rows, error: productError } = await supabase
    .from('requirement_products')
    .select('product_id, quantity, product:products(name, status)')
    .eq('requirement_id', requirementId)
  if (productError) return { error: productError.message }

  const products = (rows || []).map((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product
    return {
      productId: String(row.product_id),
      name: product?.name || 'A product',
      quantity: Number(row.quantity) || Number(requirement.quantity) || 1,
      status: product?.status || null,
    }
  })
  if (!products.length) return { error: 'Add at least one product before creating an order' }
  const inactive = products.find((product) => product.status && product.status !== 'active')
  if (inactive) return { error: `${inactive.name} is no longer active` }

  const prices: Record<string, string> = {}
  for (const product of products) {
    prices[product.productId] = String(formData.get(`unit_price_${product.productId}`) ?? '')
  }
  const parsed = parseDirectOrderPrices(products, prices)
  if (!parsed.ok) return parsed

  const { data: orderId, error } = await supabase.rpc('create_order_from_requirement', {
    p_requirement_id: requirementId,
    p_prices: parsed.lines.map((line) => ({
      product_id: line.productId,
      unit_price: line.unitPrice,
    })),
  })
  if (error || !orderId) {
    const message = error?.message || 'Could not create the order'
    if (/create_order_from_requirement|schema cache/i.test(message)) {
      return { error: 'Creating an order without a quotation needs the database update. It has not been applied yet.' }
    }
    return { error: message }
  }

  await writeAudit(supabase, {
    action: 'create',
    entity: 'order',
    entityId: String(orderId),
    next: {
      requirement_id: requirementId,
      without_quotation: true,
      source: 'crm',
    },
    userId: profile.id,
  })

  revalidatePath(`/crm/requirements/${requirementId}`)
  revalidatePath('/crm/requirements')
  revalidatePath('/crm/orders')
  revalidatePath(`/crm/orders/${orderId}`)
  redirect(`/crm/orders/${orderId}`)
}
