import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, LEAD_STAGE_LABELS, oneRelation, asRows } from '@/lib/utils'
import { Plus, User } from 'lucide-react'

const STAGE_COLORS: Record<string, string> = {
  cold: 'border border-[#CCC5BD] text-[#4A4640] bg-transparent',
  warm: 'bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30',
  hot: 'bg-[#FFB690]/40 text-[#9E4300] border border-[#9E4300]/40',
  client: 'bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20',
  regular_client: 'bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/30',
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
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-5 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
              Leads
            </h1>
            <span className="font-mono text-xs text-[#7C766F]">[ {leadRows.length} ]</span>
          </div>
          <p className="mt-1 text-xs text-[#4A4640]">{leadRows.length} leads total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex rounded-none border border-[#CCC5BD] bg-[#FCF9F2]">
            <Link
              href="?view=kanban"
              className={`px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                view === 'kanban'
                  ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                  : 'text-[#4A4640] hover:bg-[#F6F3EC]'
              }`}
            >
              Kanban
            </Link>
            <Link
              href="?view=table"
              className={`px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                view === 'table'
                  ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                  : 'text-[#4A4640] hover:bg-[#F6F3EC]'
              }`}
            >
              Table
            </Link>
          </div>
          <Link
            href="/crm/leads/new"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-none bg-[#1C1B1A] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
          >
            <Plus size={14} /> Add Lead
          </Link>
        </div>
      </div>

      {leadsError && (
        <div className="mb-4 rounded-none border border-[#BA1A1A]/40 bg-[#BA1A1A]/10 px-4 py-3 text-xs text-[#BA1A1A]">
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
      <div className="mb-6 hidden md:block bg-[#FCF9F2] border border-[#CCC5BD] p-3 sm:p-4 rounded-none">
        <form className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="view" value={view} />
          <select
            name="stage"
            defaultValue={params.stage || ''}
            className="min-h-9 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-1.5 text-sm text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          >
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>{LEAD_STAGE_LABELS[s]}</option>
            ))}
          </select>
          <select
            name="owner"
            defaultValue={params.owner || ''}
            className="min-h-9 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-1.5 text-sm text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          >
            <option value="">All Owners</option>
            {owners?.map((o) => (
              <option key={o.id} value={o.id}>{o.full_name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-9 rounded-none border border-[#1C1B1A] bg-transparent px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#F6F3EC] transition-colors"
          >
            Filter
          </button>
        </form>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageLeads = groupedLeads[stage] || []
            return (
              <div key={stage} className="w-[min(16.5rem,78vw)] flex-shrink-0 sm:w-72 bg-[#FCF9F2] border border-[#CCC5BD] p-3 rounded-none">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#CCC5BD]">
                  <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] rounded-none ${STAGE_COLORS[stage]}`}>
                    {LEAD_STAGE_LABELS[stage]}
                  </span>
                  <span className="font-mono text-xs text-[#7C766F]">[ {stageLeads.length} ]</span>
                </div>
                <div className="space-y-3">
                  {stageLeads.length === 0 ? (
                    <div className="rounded-none border border-dashed border-[#CCC5BD] p-4 text-center text-xs text-[#7C766F] bg-[#F6F3EC]">
                      No leads
                    </div>
                  ) : (
                    stageLeads.map((lead: LeadRow) => {
                      const company = oneRelation(lead.company)
                      const contact = oneRelation(lead.contact)
                      return (
                        <Link
                          key={lead.id}
                          href={`/crm/leads/${lead.id}`}
                          className="block bg-[#FCF9F2] border border-[#CCC5BD] rounded-none p-3.5 hover:bg-[#F6F3EC] transition-colors"
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <span className="font-semibold text-sm text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                              {company?.name || 'Unknown Company'}
                            </span>
                          </div>
                          {contact?.full_name && (
                            <p className="text-xs text-[#4A4640] flex items-center gap-1 mb-2">
                              <User size={12} className="text-[#7C766F]" /> {contact.full_name}
                              {contact.designation && ` · ${contact.designation}`}
                            </p>
                          )}
                          {lead.estimated_value ? (
                            <p className="font-mono text-sm font-semibold text-[#1C1B1A]">
                              {formatCurrency(lead.estimated_value)}
                            </p>
                          ) : null}
                          <p className="font-mono text-[11px] text-[#7C766F] mt-2">
                            {formatDate(lead.created_at)}
                          </p>
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
              <tr>
                <th className="py-3 px-4 font-bold text-left">Company</th>
                <th className="py-3 px-4 font-bold text-left">Contact</th>
                <th className="py-3 px-4 font-bold text-left">Stage</th>
                <th className="py-3 px-4 font-bold text-left">Owner</th>
                <th className="py-3 px-4 font-bold text-right">Value</th>
                <th className="py-3 px-4 font-bold text-left">Follow-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CCC5BD]">
              {leadRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-[#7C766F]">
                    No leads found.
                  </td>
                </tr>
              ) : (
                leadRows.map((lead: LeadRow) => {
                  const company = oneRelation(lead.company)
                  const contact = oneRelation(lead.contact)
                  const owner = oneRelation(lead.owner)
                  return (
                    <tr key={lead.id} className="hover:bg-[#F6F3EC] transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-sm">
                        <Link href={`/crm/leads/${lead.id}`} className="text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                          {company?.name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-[#4A4640]">{contact?.full_name || '—'}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] rounded-none ${STAGE_COLORS[lead.stage] || 'border border-[#CCC5BD] text-[#4A4640]'}`}>
                          {LEAD_STAGE_LABELS[lead.stage]}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-[#4A4640]">{owner?.full_name || '—'}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm text-[#1C1B1A]">
                        {lead.estimated_value ? formatCurrency(lead.estimated_value) : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-[#4A4640]">
                        {lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
