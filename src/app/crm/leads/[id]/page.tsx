import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { updateLeadStageForm, updateLead, removeLead } from '../actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { Building2, User } from 'lucide-react'
import { requireStaff } from '@/lib/auth'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireStaff(['admin', 'sales', 'management'])
  if (!isUuid(id)) notFound()
  const supabase = await createClient()

  const [{ data: lead }, { data: contacts }] = await Promise.all([
    supabase
      .from('leads')
      .select('*, company:companies(*), contact:contacts(*), owner:profiles!leads_owner_id_fkey(full_name)')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('contacts').select('id, full_name, company_id').order('full_name'),
  ])

  if (!lead) notFound()

  const company = oneRelation(lead.company)
  const contact = oneRelation(lead.contact)
  const owner = oneRelation(lead.owner)
  const stages = ['cold', 'warm', 'hot', 'client', 'regular_client']
  const currentIndex = stages.indexOf(lead.stage)

  const stageChip = (() => {
    switch (lead.stage) {
      case 'client':
      case 'regular_client':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3A4537]" />
            {lead.stage.replace('_', ' ')}
          </span>
        )
      case 'hot':
      case 'warm':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9E4300]" />
            {lead.stage}
          </span>
        )
      case 'cold':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] border border-[#CCC5BD] text-[#4A4640] bg-[#F6F3EC] rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C766F]" />
            {lead.stage || 'cold'}
          </span>
        )
    }
  })()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <BackButton href="/crm/leads" label="Back to Leads" />

      {/* Header Panel */}
      <div className="bg-[#FCF9F2] p-6 border border-[#CCC5BD] rounded-none shadow-none flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#7C766F] mb-1.5">
            <Link href="/crm/dashboard" className="hover:text-[#9E4300] transition-colors">CRM</Link>
            <span>/</span>
            <Link href="/crm/leads" className="hover:text-[#9E4300] transition-colors">LEADS</Link>
            <span>/</span>
            <span className="text-[#9E4300] font-semibold">{company?.name || lead.id.slice(0, 8)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
              {company?.name || 'Lead Details'}
            </h1>
            {stageChip}
          </div>

          <p className="text-xs text-[#4A4640] mt-1.5">
            Account Executive: <span className="font-semibold text-[#1C1B1A]">{owner?.full_name || 'Unassigned'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 shrink-0 self-start xl:self-center">
          <div className="text-left xl:text-right">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Estimated Pipeline Value</span>
            <span className="font-mono text-2xl font-bold text-[#1C1B1A] mt-0.5 block">
              {lead.estimated_value ? formatCurrency(lead.estimated_value) : '—'}
            </span>
          </div>
          {['admin', 'sales'].includes(profile.role) && (
            <div>
              <ConfirmAction
                title="Delete lead?"
                confirmLabel="Delete"
                action={removeLead}
                hiddenFields={{ id: lead.id }}
                description={<p>Lead for <span className="font-semibold text-[#1C1B1A]">{company?.name || 'this company'}</span> will be removed if it has no linked requirements.</p>}
              >
                Delete lead
              </ConfirmAction>
            </div>
          )}
        </div>
      </div>

      {/* Stage Progression Bar */}
      <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
        <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
          <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">Lead Progression</h2>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-[#CCC5BD] -z-0" />
            {stages.map((stage, idx) => {
              const isCompleted = idx <= currentIndex
              return (
                <div key={stage} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-8 h-8 rounded-none border flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                      isCompleted
                        ? 'bg-[#1C1B1A] text-[#FCF9F2] border-[#1C1B1A]'
                        : 'bg-[#F6F3EC] text-[#7C766F] border-[#CCC5BD]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <p
                    className={`mt-2 text-[11px] font-bold uppercase tracking-[0.12em] ${
                      isCompleted ? 'text-[#9E4300]' : 'text-[#7C766F]'
                    }`}
                  >
                    {stage.replace('_', ' ')}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="pt-4 border-t border-[#CCC5BD] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Update Current Pipeline Stage:</span>
            <ActionForm action={updateLeadStageForm.bind(null, id)} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <MobileSheetSelect
                name="stage"
                label="Stage"
                defaultValue={lead.stage}
                options={stages.map((s) => ({ value: s, label: s.replace('_', ' ').toUpperCase() }))}
              />
              <SubmitButton
                className="w-full px-4 py-2 bg-[#1C1B1A] hover:bg-[#9E4300] text-[#FCF9F2] text-xs font-bold uppercase tracking-[0.12em] rounded-none transition-colors shadow-none sm:w-auto"
                pendingLabel="Saving…"
              >
                Save Stage
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD] flex items-center gap-2">
            <Building2 size={16} className="text-[#9E4300]" />
            <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
              Company Details
            </h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company</span>
              <span className="mt-0.5 block text-[#1C1B1A]">
                {company?.id ? (
                  <Link href={`/crm/companies/${company.id}`} className="text-[#9E4300] hover:underline font-semibold">
                    {company.name}
                  </Link>
                ) : '—'}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Industry</span>
              <span className="mt-0.5 block text-[#1C1B1A]">{company?.industry || '—'}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Location</span>
              <span className="mt-0.5 block text-[#1C1B1A]">{[company?.city, company?.state].filter(Boolean).join(', ') || '—'}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Source</span>
              <span className="mt-0.5 block text-[#1C1B1A] capitalize">{lead.source || 'Direct Outreach'}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Next Follow-up</span>
              <span className="mt-0.5 block font-mono text-[#1C1B1A]">{formatDate(lead.next_follow_up_at)}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD] flex items-center gap-2">
            <User size={16} className="text-[#9E4300]" />
            <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
              Primary Contact
            </h2>
          </div>
          <div className="p-4 text-xs">
            {contact ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Name</span>
                  <span className="mt-0.5 block font-semibold text-[#1C1B1A]">{contact.full_name}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Designation</span>
                  <span className="mt-0.5 block text-[#1C1B1A]">{contact.designation || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Email</span>
                  <span className="mt-0.5 block text-[#1C1B1A]">{contact.email || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Phone</span>
                  <span className="mt-0.5 block text-[#1C1B1A]">{contact.phone || '—'}</span>
                </div>
              </div>
            ) : (
              <p className="text-[#7C766F] italic">No specific contact assigned.</p>
            )}
          </div>
        </div>

        <div className="md:col-span-2 bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
            <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
              Edit Lead
            </h2>
          </div>
          <ActionForm action={updateLead} className="p-6 grid md:grid-cols-2 gap-4 text-xs">
            <input type="hidden" name="id" value={lead.id} />
            <MobileSheetSelect
              name="contact_id"
              label="Contact"
              showDesktopLabel
              defaultValue={lead.contact_id || ''}
              emptyLabel="No contact"
              options={[
                { value: '', label: 'No contact' },
                ...(contacts || [])
                  .filter((c) => c.company_id === lead.company_id)
                  .map((c) => ({ value: c.id, label: c.full_name })),
              ]}
            />
            <MobileSheetSelect
              name="source"
              label="Source"
              showDesktopLabel
              defaultValue={lead.source || 'other'}
              options={[
                { value: 'inbound', label: 'Inbound' },
                { value: 'referral', label: 'Referral' },
                { value: 'event', label: 'Event' },
                { value: 'outbound', label: 'Outbound' },
                { value: 'website', label: 'Website' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <label className="block space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Estimated Value</span>
              <input
                name="estimated_value"
                type="number"
                min="0"
                step="0.01"
                defaultValue={lead.estimated_value || 0}
                className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 font-mono"
              />
            </label>
            <SheetDateField
              name="next_follow_up_at"
              label="Next follow-up"
              showDesktopLabel
              defaultValue={lead.next_follow_up_at ? String(lead.next_follow_up_at).slice(0, 10) : ''}
            />
            <label className="md:col-span-2 block space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Notes</span>
              <textarea
                name="notes"
                rows={3}
                defaultValue={lead.notes || ''}
                className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
              />
            </label>
            <SubmitButton
              className="md:col-span-2 px-4 py-2.5 rounded-none text-[#FCF9F2] bg-[#1C1B1A] hover:bg-[#9E4300] font-bold uppercase tracking-[0.12em] text-xs transition-colors shadow-none"
              pendingLabel="Saving…"
            >
              Save lead
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  )
}
