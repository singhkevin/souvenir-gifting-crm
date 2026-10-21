import { appName } from '@/lib/brand'

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shell(title: string, body: string) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1B2430;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">${escapeHtml(title)}</h1>
      ${body}
      <p style="font-size: 12px; line-height: 1.6; color: #8A929C;">${escapeHtml(appName())}</p>
    </div>
  `
}

function button(href: string, label: string) {
  return `<p style="margin: 28px 0;"><a href="${escapeHtml(href)}" style="background:#806A50;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">${escapeHtml(label)}</a></p>`
}

function paragraph(text: string) {
  return `<p style="font-size: 14px; line-height: 1.6; color: #5C6570;">${escapeHtml(text)}</p>`
}

export function businessConfirmEmailHtml(actionLink: string) {
  return shell('Confirm your business account', `${paragraph('Confirm your email to open your business account. You can then browse indicative prices and request a quote.')}${button(actionLink, 'Confirm email')}`)
}

export function businessVerifiedEmailHtml(dashboardUrl: string) {
  return shell('Your business account is verified', `${paragraph('Your account is verified. Accepted quotes can now be checked out on the store at the quoted price.')}${button(dashboardUrl, 'Open your account')}`)
}

export function businessRejectedEmailHtml() {
  return shell('Business account update', paragraph('We could not approve this business account. Reply to this email if you think that is a mistake.'))
}

export function businessRfqReceiptEmailHtml(requestUrl: string) {
  return shell('We received your quote request', `${paragraph('Your request is with the team. We will send a quotation to this account.')}${button(requestUrl, 'View request')}`)
}

export function businessRfqOwnerEmailHtml(input: { company: string; requirementUrl: string }) {
  return shell('New business quote request', `${paragraph(`${input.company} submitted a quote request.`)}${button(input.requirementUrl, 'Open requirement')}`)
}

export function publicQuoteOwnerEmailHtml(input: {
  company: string
  leadUrl: string
  requirementUrl?: string | null
  detail?: string | null
}) {
  const text = input.detail || `${input.company} asked for a quote from the public catalogue.`
  const action = input.requirementUrl ? button(input.requirementUrl, 'Open requirement') : button(input.leadUrl, 'Open lead')
  return shell('New website quote request', `${paragraph(text)}${action}`)
}

export function businessQuoteSentEmailHtml(input: { number: string; quoteUrl: string; total?: string; validUntil?: string }) {
  const total = input.total ? ` Total incl. GST ${input.total}.` : ''
  const until = input.validUntil ? ` Valid until ${input.validUntil}.` : ''
  return shell(
    'Your quotation is ready',
    `${paragraph(`Quotation ${input.number} is ready to review. Line amounts are ex-GST and GST is added once.${total}${until}`)}${button(input.quoteUrl, 'View quotation')}`,
  )
}

export function businessQuoteExpiringEmailHtml(input: { number: string; quoteUrl: string }) {
  return shell('Your quotation expires in 3 days', `${paragraph(`Quotation ${input.number} expires in 3 days.`)}${button(input.quoteUrl, 'Review quotation')}`)
}

export function businessQuoteExpiredEmailHtml(input: { number: string; quoteUrl: string }) {
  return shell('Your quotation has expired', `${paragraph(`Quotation ${input.number} has expired. You can ask us to quote it again.`)}${button(input.quoteUrl, 'View quotation')}`)
}

export function businessResponseOwnerEmailHtml(input: { title: string; detail: string; quoteUrl: string }) {
  return shell(input.title, `${paragraph(input.detail)}${button(input.quoteUrl, 'Open quotation')}`)
}

export function businessCheckoutDoneEmailHtml(input: { number: string; orderUrl: string }) {
  return shell('Quote checkout completed', `${paragraph(`An order was placed from quotation ${input.number}.`)}${button(input.orderUrl, 'Open order')}`)
}
