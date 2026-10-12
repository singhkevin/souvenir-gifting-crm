'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { requestOrigin } from '@/lib/auth/request-origin'
import { issueQuoteCheckoutLink } from '@/lib/business/tokens'
import { businessRejectedEmailHtml, businessVerifiedEmailHtml, businessQuoteSentEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'

async function loadBusinessCompany(companyId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' as const }
  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, owner_id, account_type, business_verification, status')
    .eq('id', companyId)
    .maybeSingle()
  if (!company || company.account_type !== 'business') return { error: 'This is not a business account' as const }
  const allowed = profile.role === 'admin' || (profile.role === 'sales' && company.owner_id === profile.id)
  if (!allowed) return { error: 'Not permitted' as const }
  return { profile, company, supabase }
}

export async function setBusinessVerification(formData: FormData) {
  const companyId = String(formData.get('company_id') || '')
  const next = String(formData.get('verification') || '')
  if (!isUuid(companyId)) return { error: 'Company not found' }
  if (next !== 'verified' && next !== 'rejected' && next !== 'blocked') return { error: 'Choose an action' }

  const loaded = await loadBusinessCompany(companyId)
  if ('error' in loaded && !('company' in loaded)) return { error: loaded.error }
  const { profile, company, supabase } = loaded as Exclude<typeof loaded, { error: string }>

  if (next === 'blocked') {
    if (company.status === 'inactive') return { success: true }
    const { error } = await supabase.from('companies').update({ status: 'inactive' }).eq('id', companyId)
    if (error) return { error: error.message }
    const admin = createAdminClient()
    if (admin) {
      await admin.from('profiles').update({ is_active: false }).eq('company_id', companyId).eq('role', 'business_user')
    }
    await writeAudit(supabase, {
      action: 'status_change',
      entity: 'companies',
      entityId: companyId,
      previous: { status: company.status },
      next: { status: 'inactive', business_blocked: true },
      userId: profile.id,
    })
    revalidatePath(`/crm/companies/${companyId}`)
    return { success: true }
  }

  if (company.business_verification === next) return { success: true }

  const patch = next === 'verified'
    ? {
        business_verification: 'verified',
        business_verified_at: new Date().toISOString(),
        business_verified_by: profile.id,
      }
    : {
        business_verification: 'rejected',
        business_verified_at: new Date().toISOString(),
        business_verified_by: profile.id,
      }
  const { error } = await supabase.from('companies').update(patch).eq('id', companyId)
  if (error) return { error: error.message }

  await writeAudit(supabase, {
    action: 'status_change',
    entity: 'companies',
    entityId: companyId,
    previous: { business_verification: company.business_verification },
    next: patch,
    userId: profile.id,
  })

  const admin = createAdminClient()
  const origin = await requestOrigin()
  if (admin) {
    const { data: users } = await admin.from('profiles').select('email').eq('company_id', companyId).eq('role', 'business_user').eq('is_active', true)
    for (const user of users || []) {
      if (!user.email) continue
      await sendEmail({
        to: user.email,
        subject: next === 'verified' ? 'Your business account is verified' : 'Business account update',
        html: next === 'verified' ? businessVerifiedEmailHtml(`${origin}/business/dashboard`) : businessRejectedEmailHtml(),
      })
    }
    if (next === 'verified') {
      const { data: quotes } = await admin
        .from('quotations')
        .select('id, quotation_number, contact_id')
        .eq('company_id', companyId)
        .eq('status', 'accepted')
      for (const quote of quotes || []) {
        const link = await issueQuoteCheckoutLink(quote.id, origin)
        if (!link?.url || !quote.contact_id) continue
        const { data: contact } = await admin.from('contacts').select('email').eq('id', quote.contact_id).maybeSingle()
        if (!contact?.email) continue
        await sendEmail({
          to: contact.email,
          subject: 'Your quotation is ready to check out',
          html: businessQuoteSentEmailHtml({ number: quote.quotation_number || 'Quotation', quoteUrl: link.url }),
        })
      }
    }
  }

  revalidatePath(`/crm/companies/${companyId}`)
  revalidatePath('/crm/companies')
  return { success: true }
}
