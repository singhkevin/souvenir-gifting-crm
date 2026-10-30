import 'server-only'

import { storeOrigin } from '@/lib/portal-host'
import { sendEmail } from '@/lib/email/resend'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  settleStockAlertJob,
  type PendingStockAlert,
  type StockAlertMessage,
} from '@/lib/catalogue/stock-alert-plan'

type JobRow = {
  id: string
  product_id: string
  previous_qty: number
  next_qty: number
}

type AlertRow = {
  id: string
  email: string
  full_name: string | null
  status: string
  product_id: string
}

function productUrl(productId: string) {
  return `${storeOrigin(null)}/catalogue/${productId}`
}

async function sendAlert(message: StockAlertMessage) {
  return sendEmail({ to: message.to, subject: message.subject, html: message.html })
}

/**
 * Drain stock-alert jobs the database enqueued when `products.stock_qty` increased.
 * Safe to call when the migration is not applied yet.
 */
export async function dispatchPendingStockAlerts() {
  const admin = createAdminClient()
  if (!admin) return

  const jobs = await admin
    .from('store_stock_alert_jobs')
    .select('id, product_id, previous_qty, next_qty')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20)
  if (jobs.error) {
    if (/store_stock_alert_jobs|schema cache/i.test(jobs.error.message)) return
    console.error('[stock-alert] jobs', jobs.error.message)
    return
  }

  for (const job of (jobs.data || []) as JobRow[]) {
    const [alerts, product] = await Promise.all([
      admin
        .from('store_stock_alerts')
        .select('id, email, full_name, status, product_id')
        .eq('product_id', job.product_id)
        .eq('status', 'pending'),
      admin.from('products').select('name').eq('id', job.product_id).maybeSingle(),
    ])
    if (alerts.error) {
      console.error('[stock-alert] alerts', alerts.error.message)
      continue
    }
    const name = product.data?.name ? String(product.data.name) : 'This gift'
    const url = productUrl(job.product_id)
    const pending: PendingStockAlert[] = ((alerts.data || []) as AlertRow[]).map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      productName: name,
      productUrl: url,
      status: row.status === 'sent' || row.status === 'cancelled' ? row.status : 'pending',
    }))
    const settled = await settleStockAlertJob({
      previousQty: job.previous_qty,
      nextQty: job.next_qty,
      alerts: pending,
      send: sendAlert,
    })
    if (settled.sentIds.length) {
      await admin
        .from('store_stock_alerts')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .in('id', settled.sentIds)
    }
    if (settled.jobStatus === 'done') {
      await admin
        .from('store_stock_alert_jobs')
        .update({ status: 'done', processed_at: new Date().toISOString() })
        .eq('id', job.id)
    }
  }
}
