'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { withIdempotency } from '@/lib/idempotency'
export async function recordPayment(formData: FormData) {
  return withIdempotency('crm.recordPayment', formData, () => recordPaymentOnce(formData))
}

async function recordPaymentOnce(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const invoiceId = formData.get('invoice_id') as string
  const { error } = await supabase.from('payments').insert({
    invoice_id: invoiceId,
    payment_date: formData.get('payment_date') as string,
    amount: Number(formData.get('amount')),
    method: formData.get('method') as string,
    reference: formData.get('reference') as string || null,
    notes: formData.get('notes') as string || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  const { data: invoice } = await supabase.from('invoices').select('amount').eq('id', invoiceId).single()
  const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId)
  const totalPaid = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0
  const newStatus = totalPaid >= Number(invoice?.amount) ? 'paid' : 'partially_paid'
  await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
  revalidatePath(`/crm/invoices/${invoiceId}`)
  return { success: true }
}
