import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { updateLeadStage, updateLead, removeLead } from '../actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { asFormAction } from '@/lib/form-action'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { TrendingUp, Building2, User, Calendar, DollarSign } from 'lucide-react'
import { requireStaff } from '@/lib/auth'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'

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

  const handleUpdateStage = async (formData: FormData) => {
    'use server'
    const newStage = formData.get('stage') as string
    await updateLeadStage(id, newStage)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton href="/crm/leads" label="Back to Leads" />

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-[#4A235A]/10 text-[#4A235A] rounded-lg">
              <TrendingUp size={16} />
            </span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Corporate Lead</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {(company?.name || 'Lead Details')}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Account Executive: <span className="font-semibold text-gray-800">{owner?.full_name || 'Unassigned'}</span>
          </p>
        </div>

        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 text-right">
          <p className="text-[10px] uppercase font-bold text-gray-400">Estimated Pipeline Value</p>
          <p className="text-2xl font-bold text-[#4A235A]">
            {lead.estimated_value ? formatCurrency(lead.estimated_value) : '?'}
          </p>
          {['admin', 'sales'].includes(profile.role) && (
            <div className="mt-3">
              <ConfirmAction
                title="Delete lead?"
                confirmLabel="Delete"
                action={asFormAction(removeLead)}
                hiddenFields={{ id: lead.id }}
                description={<p>Lead for <span className="font-semibold">{company?.name || 'this company'}</span> will be removed if it has no linked requirements.</p>}
              >
                Delete lead
              </ConfirmAction>
            </div>
          )}
        </div>
      </div>

      {/* Stage Progression Bar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Lead Progression</h3>
        
        <div className="flex items-center justify-between relative">
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-0" />
          {stages.map((stage, idx) => {
            const isCompleted = idx <= currentIndex
            return (
              <div key={stage} className="flex flex-col items-center relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCompleted ? 'bg-[#4A235A] text-white ring-4 ring-purple-50' : 'bg-gray-100 text-gray-400'
                }`}>
                  {idx + 1}
                </div>
                <p className={`mt-2 text-[11px] font-semibold capitalize ${
                  isCompleted ? 'text-[#4A235A]' : 'text-gray-400'
                }`}>
                  {stage.replace('_', ' ')}
                </p>
              </div>
            )
          })}
        </div>

        <div className="pt-4 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-gray-500 font-medium">Update Current Pipeline Stage:</span>
          <form action={handleUpdateStage} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <MobileSheetSelect
              name="stage"
              label="Stage"
              defaultValue={lead.stage}
              options={stages.map((s) => ({ value: s, label: s.replace('_', ' ').toUpperCase() }))}
            />
            <button
              type="submit"
              className="w-full px-4 py-1.5 bg-[#4A235A] hover:bg-[#3d1c4a] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm sm:w-auto"
            >
              Save Stage
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3 text-xs">
          <h2 className="font-bold text-sm text-gray-900 pb-2 border-b border-gray-100 flex items-center gap-2">
            <Building2 size={16} className="text-[#4A235A]" /> Company Details
          </h2>
          <div><span className="font-semibold text-gray-500 w-24 inline-block">Company:</span> {company?.id ? <Link href={`/crm/companies/${company.id}`} className="text-[#4A235A] hover:underline font-bold">{company.name}</Link> : '—'}</div>
          <div><span className="font-semibold text-gray-500 w-24 inline-block">Industry:</span> {company?.industry || '?'}</div>
          <div><span className="font-semibold text-gray-500 w-24 inline-block">Location:</span> {[company?.city, company?.state].filter(Boolean).join(', ') || '?'}</div>
          <div><span className="font-semibold text-gray-500 w-24 inline-block">Source:</span> {lead.source || 'Direct Outreach'}</div>
          <div><span className="font-semibold text-gray-500 w-24 inline-block">Next Follow-up:</span> {formatDate(lead.next_follow_up_at)}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3 text-xs">
          <h2 className="font-bold text-sm text-gray-900 pb-2 border-b border-gray-100 flex items-center gap-2">
            <User size={16} className="text-[#4A235A]" /> Primary Contact
          </h2>
          {contact ? (
            <>
              <div><span className="font-semibold text-gray-500 w-24 inline-block">Name:</span> <span className="font-bold text-gray-900">{contact.full_name}</span></div>
              <div><span className="font-semibold text-gray-500 w-24 inline-block">Designation:</span> {contact.designation || '?'}</div>
              <div><span className="font-semibold text-gray-500 w-24 inline-block">Email:</span> {contact.email || '?'}</div>
              <div><span className="font-semibold text-gray-500 w-24 inline-block">Phone:</span> {contact.phone || '?'}</div>
            </>
          ) : (
            <p className="text-gray-400 italic">No specific contact assigned.</p>
          )}
        </div>

        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-2">
          <h2 className="font-bold text-sm text-gray-900">Edit lead</h2>
          <form action={asFormAction(updateLead)} className="grid md:grid-cols-2 gap-3 text-xs">
            <input type="hidden" name="id" value={lead.id} />
            <MobileSheetSelect
              name="contact_id"
              label="Contact"
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
            <input name="estimated_value" type="number" min="0" step="0.01" defaultValue={lead.estimated_value || 0} className="border rounded-lg px-2 py-2" />
            <SheetDateField
              name="next_follow_up_at"
              label="Next follow-up"
              defaultValue={lead.next_follow_up_at ? String(lead.next_follow_up_at).slice(0, 10) : ''}
            />
            <textarea name="notes" rows={3} defaultValue={lead.notes || ''} className="md:col-span-2 border rounded-lg px-2 py-2" />
            <button className="md:col-span-2 px-4 py-2 rounded-lg text-white bg-[#4A235A] font-semibold">Save lead</button>
          </form>
        </div>
      </div>
    </div>
  )
}
