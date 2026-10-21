import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { formatCurrency, formatDate, asRows, oneRelation } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  draft: 'border border-[#CCC5BD] text-[#4A4640] bg-transparent',
  active: 'bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30',
  quoted: 'bg-[#FFB690]/20 text-[#9E4300] border border-[#9E4300]/20',
  closed: 'border border-[#CCC5BD] text-[#4A4640] bg-transparent',
  won: 'bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20',
  lost: 'bg-[#BA1A1A]/10 text-[#BA1A1A] border border-[#BA1A1A]/40',
}

import { requireStaff, applyOwnerScope } from '@/lib/auth'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

type ReqCompany = { id: string; name: string; account_type?: string | null; business_verification?: string | null; gst_number?: string | null }
type ReqOwner = { id: string; full_name: string | null }
type RequirementRow = {
  id: string
  title?: string | null
  name?: string | null
  budget?: number | null
  quantity?: number | null
  deadline?: string | null
  status?: string | null
  source?: string | null
  company?: ReqCompany | ReqCompany[] | null
  owner?: ReqOwner | ReqOwner[] | null
}

export default async function RequirementsPage(props: { searchParams: Promise<{ status?: string; source?: string }> }) {
  const profile = await requireStaff()
  const searchParams = await props.searchParams
  const statusFilter = searchParams.status || 'all'
  const sourceFilter = searchParams.source || 'all'
  
  const supabase = await createClient()

  let query = supabase
    .from('requirements')
    .select('*, company:companies(id, name, account_type, business_verification, gst_number), owner:profiles(id, full_name)')
    .order('created_at', { ascending: false })
  query = applyOwnerScope(query, profile)

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }
  if (sourceFilter !== 'all') {
    query = query.eq('source', sourceFilter)
  }

  const listed = await query
  let requirements = listed.data
  const requirementError = listed.error
  if (requirementError && /account_type|business_verification|gst_number|source/i.test(requirementError.message)) {
    let fallback = supabase
      .from('requirements')
      .select('*, company:companies(id, name), owner:profiles(id, full_name)')
      .order('created_at', { ascending: false })
    fallback = applyOwnerScope(fallback, profile)
    if (statusFilter !== 'all') fallback = fallback.eq('status', statusFilter)
    const retried = await fallback
    requirements = retried.data
  }
  const requirementRows = asRows<RequirementRow>(requirements)
  const requirementIds = requirementRows.map((row) => row.id)
  const lineResult = requirementIds.length
    ? await supabase
      .from('requirement_products')
      .select('requirement_id, quantity, product:products(name, sku)')
      .in('requirement_id', requirementIds)
    : { data: [], error: null }
  const linesByRequirement = new Map<string, { label: string; quantity: number }[]>()
  if (!lineResult.error) {
    for (const row of asRows<{
      requirement_id: string
      quantity: number | null
      product?: { name?: string | null; sku?: string | null } | { name?: string | null; sku?: string | null }[] | null
    }>(lineResult.data)) {
      const product = oneRelation(row.product)
      const list = linesByRequirement.get(row.requirement_id) || []
      const name = product?.name ? ` ${product.name}` : ''
      list.push({
        label: product?.sku ? `${product.sku}${name}` : (product?.name || 'Item'),
        quantity: row.quantity && row.quantity > 0 ? row.quantity : 1,
      })
      linesByRequirement.set(row.requirement_id, list)
    }
  }

  const statuses = ['all', 'active', 'quoted', 'won', 'lost', 'closed', 'draft']

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-5 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
              Requirements
            </h1>
            <span className="font-mono text-xs text-[#7C766F]">[ {requirementRows.length} ]</span>
          </div>
        </div>
        <Link
          href="/crm/requirements/new"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-none bg-[#1C1B1A] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
        >
          <Plus size={14} /> Add Requirement
        </Link>
      </div>

      {/* Mobile Filter Bar */}
      <div className="mb-6 md:hidden">
        <MobileFilterBar
          pathname="/crm/requirements"
          fields={[
            {
              key: 'status',
              label: 'Status',
              value: statusFilter,
              emptyLabel: 'All',
              options: statuses.map((status) => ({
                value: status,
                label: status === 'all' ? 'All' : status,
              })),
            },
          ]}
        />
      </div>

      {/* Desktop Status Tabs */}
      <div className="mb-4 hidden flex-wrap gap-2 border-b border-[#CCC5BD] pb-2 md:flex">
        {statuses.map((status) => (
          <Link 
            key={status}
            href={`/crm/requirements?status=${status}${sourceFilter !== 'all' ? `&source=${sourceFilter}` : ''}`}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors rounded-none ${
              statusFilter === status
                ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                : 'text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            {status}
          </Link>
        ))}
      </div>

      {/* Source Filters */}
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {['all', 'business_portal', 'corporate_portal', 'website', 'staff'].map((source) => (
          <Link
            key={source}
            href={`/crm/requirements?status=${statusFilter}${source === 'all' ? '' : `&source=${source}`}`}
            className={`rounded-none px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors ${
              sourceFilter === source
                ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                : 'border border-[#CCC5BD] bg-[#FCF9F2] text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            {source === 'all' ? 'All sources' : source.replace('_', ' ')}
          </Link>
        ))}
      </div>

      {/* Mobile Card List */}
      <div className="space-y-3 md:hidden">
        {requirementRows.map((req: RequirementRow) => {
          const company = oneRelation(req.company)
          const owner = oneRelation(req.owner)
          return (
            <div key={req.id} className="bg-[#FCF9F2] border border-[#CCC5BD] p-4 rounded-none space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/crm/requirements/${req.id}`} className="font-semibold text-sm text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                    {req.title || req.name}
                  </Link>
                  {req.source === 'business_portal' ? (
                    <span className="ml-2 inline-block rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9E4300]">
                      Business
                    </span>
                  ) : null}
                  {req.source === 'website' ? (
                    <span className="ml-2 inline-block rounded-none border border-[#3A4537]/30 bg-[#DAE6D3] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#3A4537]">
                      Website
                    </span>
                  ) : null}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] rounded-none ${STATUS_COLORS[req.status || ''] || 'border border-[#CCC5BD] text-[#4A4640]'}`}>
                  {req.status || 'unknown'}
                </span>
              </div>

              {(linesByRequirement.get(req.id) || []).slice(0, 3).map((line, index) => (
                <p key={`${req.id}-${index}`} className="text-[11px] text-[#7C766F] font-mono">
                  {line.label} × {line.quantity}
                </p>
              ))}
              {(linesByRequirement.get(req.id) || []).length > 3 && (
                <p className="text-[11px] text-[#7C766F] font-mono">
                  +{(linesByRequirement.get(req.id) || []).length - 3} more
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#CCC5BD] text-[#4A4640]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Company</span>
                  <span>{company?.name || '—'}</span>
                  {company?.account_type === 'business' ? (
                    <span className="mt-0.5 block text-[10px] uppercase text-[#9E4300]">
                      {company.business_verification || 'unverified'}
                      {company.gst_number ? ` · ${company.gst_number}` : ''}
                    </span>
                  ) : null}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Owner</span>
                  <span>{owner?.full_name || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Budget</span>
                  <span className="font-mono text-sm text-[#1C1B1A]">{req.budget ? formatCurrency(req.budget) : '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Qty</span>
                  <span className="font-mono text-sm text-[#1C1B1A]">{req.quantity || '—'}</span>
                </div>
              </div>
              {req.deadline ? (
                <div className="pt-2 border-t border-[#CCC5BD] text-xs text-[#7C766F] flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Deadline</span>
                  <span className="font-mono text-xs text-[#4A4640]">{formatDate(req.deadline)}</span>
                </div>
              ) : null}
            </div>
          )
        })}
        {requirementRows.length === 0 && (
          <div className="p-8 text-center text-sm text-[#7C766F] bg-[#FCF9F2] border border-[#CCC5BD] rounded-none">
            No requirements found.
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-[#FCF9F2] border border-[#CCC5BD] rounded-none overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
            <tr>
              <th className="py-3 px-4 font-bold text-left">Name</th>
              <th className="py-3 px-4 font-bold text-left">Company</th>
              <th className="py-3 px-4 font-bold text-left">Owner</th>
              <th className="py-3 px-4 font-bold text-right">Budget</th>
              <th className="py-3 px-4 font-bold text-right">Qty</th>
              <th className="py-3 px-4 font-bold text-left">Deadline</th>
              <th className="py-3 px-4 font-bold text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD]">
            {requirementRows.map((req: RequirementRow) => {
              const company = oneRelation(req.company)
              const owner = oneRelation(req.owner)
              return (
                <tr key={req.id} className="hover:bg-[#F6F3EC] transition-colors">
                  <td className="py-2.5 px-4">
                    <Link href={`/crm/requirements/${req.id}`} className="font-semibold text-sm text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                      {req.title || req.name}
                    </Link>
                    {req.source === 'business_portal' ? (
                      <span className="ml-2 inline-block rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9E4300]">
                        Business
                      </span>
                    ) : null}
                    {req.source === 'website' ? (
                      <span className="ml-2 inline-block rounded-none border border-[#3A4537]/30 bg-[#DAE6D3] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#3A4537]">
                        Website
                      </span>
                    ) : null}
                    {(linesByRequirement.get(req.id) || []).slice(0, 3).map((line, index) => (
                      <p key={`${req.id}-${index}`} className="mt-0.5 text-[11px] text-[#7C766F] font-mono">
                        {line.label} × {line.quantity}
                      </p>
                    ))}
                    {(linesByRequirement.get(req.id) || []).length > 3 && (
                      <p className="text-[11px] text-[#7C766F] font-mono">
                        +{(linesByRequirement.get(req.id) || []).length - 3} more
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-sm text-[#4A4640]">
                    {company?.name || '—'}
                    {company?.account_type === 'business' ? (
                      <span className="mt-0.5 block text-[10px] uppercase text-[#9E4300]">
                        {company.business_verification || 'unverified'}
                        {company.gst_number ? ` · ${company.gst_number}` : ''}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 px-4 text-sm text-[#4A4640]">{owner?.full_name || '—'}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-sm text-[#1C1B1A]">
                    {req.budget ? formatCurrency(req.budget) : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-sm text-[#1C1B1A]">
                    {req.quantity || '—'}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-[#4A4640]">
                    {req.deadline ? formatDate(req.deadline) : '—'}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] rounded-none ${STATUS_COLORS[req.status || ''] || 'border border-[#CCC5BD] text-[#4A4640]'}`}>
                      {req.status || 'unknown'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {requirementRows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-[#7C766F]">
                  No requirements found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
