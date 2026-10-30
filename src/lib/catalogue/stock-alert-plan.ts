/**
 * Decides which back-in-stock alerts to send when stock increases.
 * The database trigger only enqueues a job. This is what actually fires.
 */

export type StockAlertStatus = 'pending' | 'sent' | 'cancelled'

export type PendingStockAlert = {
  id: string
  email: string
  fullName?: string | null
  productName: string
  productUrl: string
  status: StockAlertStatus
}

export type StockAlertMessage = {
  alertId: string
  to: string
  subject: string
  html: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** One email, one product link. Wording is a placeholder until the client supplies it. */
export function stockAlertEmail(input: { productName: string; productUrl: string }) {
  const name = input.productName.trim() || 'This gift'
  const url = input.productUrl.trim()
  // TODO(client): back-in-stock email wording
  const subject = `${name} is back in stock`
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1C1C18;">
      <p style="font-size: 14px; line-height: 1.6;">${escapeHtml(name)} is back in stock.</p>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(url)}" style="background:#9E4300;color:#ffffff;padding:12px 20px;text-decoration:none;font-size:13px;font-weight:600;">View the product</a>
      </p>
    </div>
  `
  return { subject, html }
}

/**
 * Pending alerts to send once, when stock goes up and is above zero.
 * The same email is only chosen once. Already sent or cancelled alerts are skipped.
 */
export function planStockAlertSends(input: {
  previousQty: number
  nextQty: number
  alerts: PendingStockAlert[]
}): PendingStockAlert[] {
  const previous = Number(input.previousQty)
  const next = Number(input.nextQty)
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return []
  if (!(next > previous) || next <= 0) return []

  const seen = new Set<string>()
  const chosen: PendingStockAlert[] = []
  for (const alert of input.alerts) {
    if (alert.status !== 'pending') continue
    const email = alert.email.trim().toLowerCase()
    if (!email.includes('@') || seen.has(email)) continue
    if (!alert.productUrl.trim()) continue
    seen.add(email)
    chosen.push(alert)
  }
  return chosen
}

export function stockAlertMessages(alerts: PendingStockAlert[]): StockAlertMessage[] {
  return alerts.map((alert) => {
    const email = stockAlertEmail({ productName: alert.productName, productUrl: alert.productUrl })
    return { alertId: alert.id, to: alert.email.trim(), subject: email.subject, html: email.html }
  })
}

/**
 * Send each planned message once. A failed send stays pending so a later run can retry.
 * The job is done only when nothing pending remains to send.
 */
export async function settleStockAlertJob(input: {
  previousQty: number
  nextQty: number
  alerts: PendingStockAlert[]
  send: (message: StockAlertMessage) => Promise<{ error?: string }>
}): Promise<{ sentIds: string[]; failedIds: string[]; jobStatus: 'done' | 'pending' }> {
  const planned = planStockAlertSends(input)
  const sentIds: string[] = []
  const failedIds: string[] = []
  for (const message of stockAlertMessages(planned)) {
    let failed = false
    try {
      const result = await input.send(message)
      failed = Boolean(result.error)
    } catch {
      failed = true
    }
    if (failed) failedIds.push(message.alertId)
    else sentIds.push(message.alertId)
  }
  return {
    sentIds,
    failedIds,
    jobStatus: failedIds.length === 0 ? 'done' : 'pending',
  }
}
