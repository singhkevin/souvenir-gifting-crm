import 'server-only'

import { cache } from 'react'
import { getProfile } from '@/lib/auth'
import { emailReviewFlag } from '@/lib/business/email-domain'
import { createClient } from '@/lib/supabase/server'
import {
  resolveBusinessAccess,
  type BusinessAccess,
  type BusinessAccessCompany,
} from '@/lib/business/access-state'

const COMPANY_COLUMNS =
  'id, name, account_type, business_verification, gst_number, city, state, country, website, notes, status, margin_percent'

/** Signed-in business audience. Cached for the request. Existing free-email accounts stay usable. */
export const getBusinessAccess = cache(async (): Promise<BusinessAccess> => {
  const profile = await getProfile()
  if (!profile) return resolveBusinessAccess({ profile: null, company: null })

  let company: BusinessAccessCompany | null = null
  if (profile.company_id) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('companies')
      .select(COMPANY_COLUMNS)
      .eq('id', profile.company_id)
      .maybeSingle()
    company = (data as BusinessAccessCompany | null) || null
  }

  return resolveBusinessAccess({
    profile,
    company,
    emailReview: emailReviewFlag(profile.email),
    emailPolicy: 'flag',
  })
})
