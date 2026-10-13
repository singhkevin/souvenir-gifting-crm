import 'server-only'

import { resolveAlertOwnerId } from '@/lib/alerts/owner'
import { businessResponseOwnerEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { createAdminClient } from '@/lib/supabase/admin'

export async function emailQuotationOwner(input: {
  quotationId: string
  origin: string
  title: string
  detail: string
}) {
  const admin = createAdminClient()
  if (!admin) return
  const { data: quote } = await admin
    .from('quotations')
    .select('quotation_number, company_id, owner_id')
    .eq('id', input.quotationId)
    .maybeSingle()
  if (!quote?.company_id) return
  const { data: company } = await admin.from('companies').select('name, owner_id').eq('id', quote.company_id).maybeSingle()
  const ownerId = await resolveAlertOwnerId(admin, quote.owner_id || company?.owner_id || null)
  if (!ownerId) return
  const { data: owner } = await admin.from('profiles').select('email').eq('id', ownerId).eq('is_active', true).maybeSingle()
  if (!owner?.email) return
  await sendEmail({
    to: owner.email,
    subject: input.title,
    html: businessResponseOwnerEmailHtml({
      title: input.title,
      detail: input.detail,
      quoteUrl: `${input.origin}/crm/quotations/${input.quotationId}`,
    }),
  })
}
