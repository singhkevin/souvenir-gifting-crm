'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isUuid } from '@/lib/utils'

function redirectApprovalError(orderId: string, message: string): never {
  const text = message.replace(/\s+/g, ' ').slice(0, 300)
  redirect(`/portal/orders/${orderId}?approval_error=${encodeURIComponent(text)}`)
}

export async function decideOrderApproval(formData: FormData) {
  const orderId = String(formData.get('order_id') || '')
  const decision = String(formData.get('decision') || '')
  const note = String(formData.get('note') || '').trim().slice(0, 2000)

  if (!isUuid(orderId)) return { error: 'Order not found' }
  if (decision !== 'approved' && decision !== 'changes_requested') {
    redirectApprovalError(orderId, 'Choose approve or request changes')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) redirectApprovalError(orderId, 'Order not found')
  if (order.status !== 'client_approval') {
    redirectApprovalError(orderId, 'This order is not waiting for client approval')
  }

  const { error } = await supabase.rpc('client_decide_order_approval', {
    p_order_id: orderId,
    p_decision: decision,
    p_note: note || null,
  })
  if (error) redirectApprovalError(orderId, error.message)

  revalidatePath(`/portal/orders/${orderId}`)
  revalidatePath('/portal/orders')
  revalidatePath('/portal')
  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/order-management')
  revalidatePath('/crm/dashboard')
  revalidatePath('/crm/my-work')
  redirect(`/portal/orders/${orderId}`)
}
