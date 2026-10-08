'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { placeClientDirectOrder } from '@/lib/catalogue/direct-order'
import { withIdempotency } from '@/lib/idempotency'
import type { CheckoutLineInput } from '@/lib/catalogue/purchase-path'

export async function checkoutPortalCart(input: { lines: CheckoutLineInput[]; idempotencyKey?: string }) {
  return withIdempotency('portal.checkout', input.idempotencyKey, () => placeClientDirectOrder({ lines: input.lines }))
}

export async function toggleOfferingSelection(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: companyId } = await supabase.rpc('client_company_id')
  if (!companyId) return { error: 'Company not found' }

  const campaignId = String(formData.get('campaign_id') || '')
  const campaignProductId = String(formData.get('campaign_product_id') || '')
  const kind = String(formData.get('kind') || 'shortlisted')
  const remove = String(formData.get('remove') || '') === '1'
  const quantity = Number(formData.get('quantity') || 1)

  if (!campaignId || !campaignProductId) return { error: 'Missing offering' }

  if (remove) {
    const { error } = await supabase
      .from('client_product_selections')
      .delete()
      .eq('campaign_product_id', campaignProductId)
      .eq('user_id', user.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('client_product_selections').upsert({
      campaign_id: campaignId,
      campaign_product_id: campaignProductId,
      company_id: companyId,
      user_id: user.id,
      kind,
      quantity: quantity > 0 ? quantity : 1,
    }, { onConflict: 'campaign_product_id,user_id' })
    if (error) return { error: error.message }
  }

  revalidatePath('/portal/catalogue')
  revalidatePath('/portal/shortlist')
  revalidatePath(`/crm/catalogs/${campaignId}`)
  return { success: true }
}

export async function toggleOfferingSelectionForm(formData: FormData) {
  return toggleOfferingSelection(formData)
}
