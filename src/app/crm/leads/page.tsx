import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, LEAD_STAGE_LABELS, oneRelation, asRows } from '@/lib/utils'
import { TrendingUp, Plus, User } from 'lucide-react'

const STAGE_COLORS: Record<string, string> = {
  cold: 'bg-gray-100 text-gray-700',
  warm: 'bg-blue-100 text-blue-700',
  hot: 'bg-orange-100 text-orange-700',
  client: 'bg-green-100 text-green-700',
  regular_client: 'bg-emerald-100 text-emerald-700',
}

import { requireStaff, applyOwnerScope } from '@/lib/auth'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

type LeadCompany = { id: string; name: string; logo_path?: string | null }
type LeadContact = { id: string; full_name: string | null; designation?: string | null }
type LeadOwner = { id: string; full_name: string | null }
type LeadRow = {
  id: string
  stage: string
  estimated_value?: number | null
  created_at?: string
  next_follow_up_at?: string | null
  company?: LeadCompany | LeadCompany[] | null
  contact?: LeadContact | LeadContact[] | null
  owner?: LeadOwner | LeadOwner[] | null
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ view?: string; stage?: string; owner?: string }> }) {
  const profile = await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()

  const params = await searchParams
  const view = params.view || 'kanban'

  let query = supabase
    .from('leads')
    .select('*, company:companies(id, name, logo_path), contact:contacts(id, full_name, designation), owner:profiles!leads_owner_id_fkey(id, full_name)')
    .order('created_at', { ascending: false })
  query = applyOwnerScope(query, profile)

  if (params.stage) query = query.eq('stage', params.stage)
  if (params.owner && profile.role !== 'sales') query = query.eq('owner_id', params.owner)

  const { data: leads, error: leadsError } = await query
  if (leadsError) {
    console.error('Leads query failed:', leadsError.message, leadsError.code, leadsError.details)
  }
  const { data: owners } = await supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales']).order('full_name')

  const stages = ['cold', 'warm', 'hot', 'client', 'regular_client']
  const leadRows = asRows<LeadRow>(leads)
  const groupedLeads = stages.reduce((acc: Record<string, LeadRow[]>, stage: string) => {
    acc[stage] = leadRows.filter((l: LeadRow) => l.stage === stage)
    return acc
  }, {})

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Leads</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{leadRows.length} leads total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
            <Link href="?view=kanban" className={`min-h-10 px-3 py-2 text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'}`}>Kanban</Link>
            <Link href="?view=table" className={`min-h-10 px-3 py-2 text-sm font-medium transition-colors ${view === 'table' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'}`}>Table</Link>
          </div>
          <Link href="/crm/leads/new" className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white sm:flex-none" style={{ background: 'var(--color-primary)' }}>
            <Plus size={16} /> Add Lead
          </Link>
        </div>
      </div>

      {leadsError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Leads could not be loaded from the database. {leadsError.message}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 md:hidden">
        <MobileFilterBar
          pathname="/crm/leads"
          preserveParams={{ view }}
          fields={[
            {
              key: 'stage',
              label: 'Stage',
              value: params.stage || '',
              emptyLabel: 'All stages',
              options: [
                { value: '', label: 'All stages' },
                ...stages.map((s) => ({ value: s, label: LEAD_STAGE_LABELS[s] })),
              ],
            },
            {
              key: 'owner',
              label: 'Owner',
              value: params.owner || '',
              emptyLabel: 'All owners',
              options: [
                { value: '', label: 'All owners' },
                ...(owners || []).map((o) => ({ value: o.id, label: o.full_name || 'Unnamed' })),
              ],
            },
          ]}
        />
      </div>
      <div className="mb-6 hidden md:block">
        <form className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="view" value={view} />
          <select name="stage" defaultValue={params.stage || ''} className="min-h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm">
            <option value="">All Stages</option>
            {stages.map(s => <option key={s} value={s}>{LEAD_STAGE_LABELS[s]}</option>)}
          </select>
          <select name="owner" defaultValue={params.owner || ''} className="min-h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm">
            <option value="">All Owners</option>
            {owners?.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
          </select>
          <button type="submit" className="min-h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
            Filter
          </button>
        </form>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageLeads = groupedLeads[stage] || []
            return (
              <div key={stage} className="w-[min(16.5rem,78vw)] flex-shrink-0 sm:w-72">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STAGE_COLORS[stage]}`}>
                    {LEAD_STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-[var(--color-muted-fg)] font-medium">{stageLeads.length}</span>
                </div>
                <div className="space-y-3">
                  {stageLeads.length === 0 ? (
                    <div className="bg-[var(--color-muted)] rounded-lg p-4 text-center text-sm text-[var(--color-muted-fg)]">No leads</div>
                  ) : stageLeads.map((lead: LeadRow) => {
                    const company = oneRelation(lead.company)
                    const contact = oneRelation(lead.contact)
                    return (
                    <Link key={lead.id} href={`/crm/leads/${lead.id}`} className="block bg-white border border-[var(--color-border)] rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-sm text-[var(--color-text)]">{company?.name || 'Unknown Company'}</span>
                      </div>
                      {contact?.full_name && (
                        <p className="text-xs text-[var(--color-muted-fg)] flex items-center gap-1 mb-2">
                          <User size={12} /> {contact.full_name}
                          {contact.designation && ` · ${contact.designation}`}
                        </p>
                      )}
                      {lead.estimated_value && (
                        <p className="text-sm font-semibold text-[var(--color-primary)]">{formatCurrency(lead.estimated_value)}</p>
                      )}
                      <p className="text-xs text-[var(--color-muted-fg)] mt-2">{formatDate(lead.created_at)}</p>
                    </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted-fg)] uppercase tracking-wide">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted-fg)] uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted-fg)] uppercase tracking-wide">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted-fg)] uppercase tracking-wide">Owner</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--color-muted-fg)] uppercase tracking-wide">Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted-fg)] uppercase tracking-wide">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {leadRows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-[var(--color-muted-fg)]">No leads found.</td></tr>
              ) : leadRows.map((lead: LeadRow) => {
                const company = oneRelation(lead.company)
                const contact = oneRelation(lead.contact)
                const owner = oneRelation(lead.owner)
                return (
                <tr key={lead.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/leads/${lead.id}`} className="hover:text-[var(--color-primary)]">{company?.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{contact?.full_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[lead.stage]}`}>{LEAD_STAGE_LABELS[lead.stage]}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{owner?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{lead.estimated_value ? formatCurrency(lead.estimated_value) : '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : '—'}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}