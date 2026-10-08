'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/utils'

function cleanError(message: string) {
  return message.replace(/\s+/g, ' ').slice(0, 300)
}

/**
 * Client approval of the mockup. client_decide_order_approval locks the order row and treats a
 * repeat of the same decision as a no-op, so a double submit cannot record two decisions.
 */
export async function decideOrderApproval(formData: FormData) {
  const orderId = String(formData.get('order_id') || '')
  const decision = String(formData.get('decision') || '')
  const note = String(formData.get('note') || '').trim().slice(0, 2000)

  if (!isUuid(orderId)) return { error: 'Order not found' }
  if (decision !== 'approved' && decision !== 'changes_requested') {
    return { error: 'Choose approve or request changes' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again to continue' }

  const { error } = await supabase.rpc('client_decide_order_approval', {
    p_order_id: orderId,
    p_decision: decision,
    p_note: note || null,
  })
  if (error) return { error: cleanError(error.message) }

  revalidatePath(`/portal/orders/${orderId}`)
  revalidatePath('/portal/orders')
  revalidatePath('/portal')
  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/order-management')
  revalidatePath('/crm/dashboard')
  revalidatePath('/crm/my-work')
  return {
    success: true,
    message: decision === 'approved' ? 'Mockup approved' : 'Changes requested',
  }
}
