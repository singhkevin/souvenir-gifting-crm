import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/utils'
import { isShareToken, shareLinkGrantsAccess } from '@/lib/catalogs/share-link'
import type { CatalogLineRow, CatalogRfqLine, ExpandedRfqLine } from '@/lib/catalogs/rfq-lines'

export type { CatalogLineRow, CatalogRfqLine, ExpandedRfqLine } from '@/lib/catalogs/rfq-lines'
export { expandCatalogRfqLines } from '@/lib/catalogs/rfq-lines'

export function rfqSchemaHint(message: string) {
  if (/campaign_id|requirement_products|client_response|client_respond_quotation|p_accepted_item_ids/i.test(message)) {
    return `${message} Apply supabase/migrations/20261005_catalog_rfq.sql and supabase/migrations/20261005_quotation_line_accept.sql, then retry.`
  }
  return message
}

export function parseRfqSelection(raw: unknown): CatalogRfqLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) return null
  const lines: CatalogRfqLine[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null
    const id = String((row as { id?: unknown }).id || '')
    const quantity = Number((row as { quantity?: unknown }).quantity)
    if (!isUuid(id) || !Number.isInteger(quantity)) return null
    lines.push({ id, quantity })
  }
  return lines
}

export function cleanRfqNotes(value: unknown) {
  return String(value || '').trim().slice(0, 2000)
}

export function cleanRfqDeadline(value: unknown): { error: string } | { deadline: string | null } {
  const raw = String(value || '').trim()
  if (!raw) return { deadline: null }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: 'Delivery date must be a valid date' }
  const parsed = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return { error: 'Delivery date must be a valid date' }
  return { deadline: raw }
}

export async function companyCanUseCatalog(
  supabase: SupabaseClient,
  campaignId: string,
  companyId: string,
) {
  const assigned = await supabase
    .from('catalog_assignments')
    .select('campaign_id')
    .eq('campaign_id', campaignId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!assigned.error) return Boolean(assigned.data)
  if (/catalog_assignments|does not exist|schema cache/i.test(assigned.error.message)) {
    const { data } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('company_id', companyId)
      .maybeSingle()
    return Boolean(data)
  }
  return false
}

export async function resolveShareCampaignId(token: string) {
  if (!isShareToken(token)) return null
  const admin = createAdminClient()
  if (!admin) return null
  const { data } = await admin
    .from('catalog_share_links')
    .select('campaign_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle()
  if (!data?.campaign_id || !shareLinkGrantsAccess(data)) return null
  return data.campaign_id as string
}

const CATALOG_LINE_SELECT =
  'id, product_id, pack_kit_id, pack_kit_role, moq, product:products!inner(sku, name, status)'

export async function loadPublishedCatalogLines(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CatalogLineRow[]> {
  const { data, error } = await supabase
    .from('campaign_products')
    .select(CATALOG_LINE_SELECT)
    .eq('campaign_id', campaignId)
    .eq('visibility', 'published')
    .eq('product.status', 'active')
  if (error) return []
  return (data || []) as CatalogLineRow[]
}

export async function insertCatalogRequirement(
  admin: SupabaseClient,
  input: {
    companyId: string
    ownerId: string | null
    contactId?: string | null
    campaignId: string
    catalogName: string
    notes: string
    deadline: string | null
    lines: ExpandedRfqLine[]
  },
): Promise<{ error?: string; id?: string }> {
  const quantity = input.lines.reduce((sum, line) => sum + line.quantity, 0)
  const description = [
    input.notes,
    `Requested from catalog ${input.catalogName}.`,
  ].filter(Boolean).join('\n\n').slice(0, 4000)

  const base = {
    name: `RFQ: ${input.catalogName}`.slice(0, 180),
    company_id: input.companyId,
    contact_id: input.contactId || null,
    owner_id: input.ownerId,
    purpose: 'other',
    description,
    deadline: input.deadline,
    quantity,
    status: 'active',
  }

  let inserted = await admin
    .from('requirements')
    .insert({ ...base, campaign_id: input.campaignId, source: 'corporate_portal' })
    .select('id')
    .single()

  if (inserted.error && /campaign_id|source/i.test(inserted.error.message)) {
    inserted = await admin.from('requirements').insert({ ...base, campaign_id: input.campaignId }).select('id').single()
  }
  if (inserted.error && /campaign_id/i.test(inserted.error.message)) {
    inserted = await admin.from('requirements').insert(base).select('id').single()
  }
  if (inserted.error || !inserted.data) {
    return { error: rfqSchemaHint(inserted.error?.message || 'Unable to save this request') }
  }

  const { error: linkError } = await admin.from('requirement_products').insert(
    input.lines.map((line) => ({
      requirement_id: inserted.data.id,
      product_id: line.product_id,
      quantity: line.quantity,
    })),
  )
  if (linkError) {
    await admin.from('requirements').delete().eq('id', inserted.data.id)
    return { error: rfqSchemaHint(linkError.message) }
  }

  return { id: inserted.data.id }
}
