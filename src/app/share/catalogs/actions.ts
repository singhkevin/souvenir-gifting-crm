'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import {
  cleanRfqDeadline,
  cleanRfqNotes,
  companyCanUseCatalog,
  expandCatalogRfqLines,
  insertCatalogRequirement,
  loadPublishedCatalogLines,
  parseRfqSelection,
  resolveShareCampaignId,
  type ExpandedRfqLine,
} from '@/lib/catalogs/rfq'

type ShareRfqInput = {
  token: string
  deadline: string
  notes: string
  lines: { id: string; quantity: number }[]
  full_name?: string
  email?: string
  company_name?: string
  phone?: string
  fax?: string
}

function clean(value: string | undefined) {
  return String(value || '').trim()
}

export async function submitShareCatalogRfq(input: ShareRfqInput): Promise<{ error?: string; success?: boolean }> {
  if (clean(input.fax)) return { success: true }

  const selected = parseRfqSelection(input.lines)
  if (!selected) return { error: 'Select at least one product and a whole-number quantity' }
  const deadline = cleanRfqDeadline(input.deadline)
  if ('error' in deadline) return deadline
  const notes = cleanRfqNotes(input.notes)

  const campaignId = await resolveShareCampaignId(input.token)
  if (!campaignId) return { error: 'This catalog link is unavailable' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Unable to send this request just now. Please try again shortly.' }

  const profile = await getProfile()
  const isClient = profile?.role === 'client_admin' || profile?.role === 'client_user'
  if (profile && !isClient) {
    return { error: 'Staff preview cannot submit a request for quotation' }
  }

  const { data: catalog } = await admin.from('campaigns').select('id, name').eq('id', campaignId).maybeSingle()
  if (!catalog?.name) return { error: 'This catalog link is unavailable' }

  const rows = await loadPublishedCatalogLines(admin, campaignId)
  const expanded = expandCatalogRfqLines(rows, selected)
  if (expanded.error || !expanded.lines) return { error: expanded.error || 'Select at least one product' }

  if (isClient) {
    const supabase = await createClient()
    const { data: companyId } = await supabase.rpc('client_company_id')
    if (!companyId) return { error: 'Company not found' }
    const allowed = await companyCanUseCatalog(supabase, campaignId, companyId)
    if (!allowed) return { error: 'This catalog is not assigned to your company' }

    const { data: company } = await supabase.from('companies').select('owner_id').eq('id', companyId).maybeSingle()
    const saved = await insertCatalogRequirement(admin, {
      companyId,
      ownerId: company?.owner_id ?? null,
      campaignId,
      catalogName: catalog.name,
      notes,
      deadline: deadline.deadline,
      lines: expanded.lines,
    })
    if (saved.error) return { error: saved.error }
    revalidatePath('/crm/requirements')
    revalidatePath('/portal/requirements')
    return { success: true }
  }

  const fullName = clean(input.full_name)
  const email = clean(input.email).toLowerCase()
  const companyName = clean(input.company_name)
  const phone = clean(input.phone)
  if (!fullName) return { error: 'Please share your name.' }
  if (!email || !email.includes('@')) return { error: 'Please share a valid work email.' }
  if (!companyName) return { error: 'Please share your company name.' }

  const saved = await createGuestCatalogRequirement(admin, {
    fullName,
    email,
    companyName,
    phone,
    catalogName: catalog.name,
    campaignId,
    notes,
    deadline: deadline.deadline,
    lines: expanded.lines,
  })
  if (saved.error) return { error: saved.error }
  revalidatePath('/crm/requirements')
  revalidatePath('/crm/leads')
  return { success: true }
}

async function createGuestCatalogRequirement(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  input: {
    fullName: string
    email: string
    companyName: string
    phone: string
    catalogName: string
    campaignId: string
    notes: string
    deadline: string | null
    lines: ExpandedRfqLine[]
  },
) {
  const { data: owner } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const { data: existingCompany } = await admin
    .from('companies')
    .select('id, owner_id')
    .ilike('name', input.companyName)
    .limit(1)
    .maybeSingle()

  let companyId = existingCompany?.id as string | undefined
  let ownerId = (existingCompany?.owner_id as string | null) || owner?.id || null
  if (!companyId) {
    const { data: created, error: companyError } = await admin
      .from('companies')
      .insert({
        name: input.companyName,
        status: 'prospect',
        owner_id: owner?.id || null,
        notes: 'Created from a catalog share-link request for quotation.',
      })
      .select('id')
      .single()
    if (companyError || !created) return { error: 'Unable to save this request. Please try again.' }
    companyId = created.id
    ownerId = owner?.id || null
  }
  if (!companyId) return { error: 'Unable to save this request. Please try again.' }

  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .insert({
      company_id: companyId,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone || null,
      contact_type: 'primary',
      kind: 'corporate',
      notes: 'Submitted via a catalog share link.',
    })
    .select('id')
    .single()
  if (contactError || !contact) return { error: 'Unable to save this request. Please try again.' }

  const requirement = await insertCatalogRequirement(admin, {
    companyId,
    ownerId,
    contactId: contact.id,
    campaignId: input.campaignId,
    catalogName: input.catalogName,
    notes: [input.notes, `${input.fullName} <${input.email}>`, input.phone].filter(Boolean).join('\n'),
    deadline: input.deadline,
    lines: input.lines,
  })
  if (requirement.error || !requirement.id) return { error: requirement.error || 'Unable to save this request' }

  const productLine = input.lines
    .map((line) => `  - ${line.name || 'Item'}${line.sku ? ` (${line.sku})` : ''} x ${line.quantity}`)
    .join('\n')
  await admin.from('leads').insert({
    company_id: companyId,
    contact_id: contact.id,
    owner_id: ownerId,
    source: 'website',
    stage: 'cold',
    notes: [
      `Catalog share RFQ: ${input.catalogName}`,
      `Requirement: ${requirement.id}`,
      productLine ? `Products:\n${productLine}` : '',
      input.deadline ? `Delivery date: ${input.deadline}` : '',
      input.notes,
    ].filter(Boolean).join('\n'),
  })

  return { id: requirement.id }
}
