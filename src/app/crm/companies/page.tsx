import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatDate, asRows, oneRelation } from '@/lib/utils';
import { CompanyAvatar } from '@/components/ui/avatar';
import { Search } from 'lucide-react';

import { requireStaff, applyCompanyScope } from '@/lib/auth'
import { portalDnsMode } from '@/lib/portal-hosts/mode'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'
import { CustomerKindBadge } from '@/components/crm/customer-kind-badge'
import { isCustomerKind } from '@/lib/companies/customer-kind'

type CompanyOwner = { full_name: string | null }
type CompanyRow = {
  id: string
  name: string
  logo_path: string | null
  industry: string | null
  city: string | null
  status: string | null
  portal_slug?: string | null
  account_type?: string | null
  is_individual?: boolean | null
  business_verification?: string | null
  created_at: string
  owner?: CompanyOwner | CompanyOwner[] | null
}

function portalDotClass(status: string | undefined) {
  switch (status) {
    case 'live':
      return 'bg-emerald-600'
    case 'failed':
    case 'blocked':
      return 'bg-[#BA1A1A]'
    case 'queued':
    case 'parking':
    case 'verifying':
      return 'bg-[#9E4300]'
    default:
      return 'bg-[#CCC5BD]'
  }
}

export default async function Companies(props: { searchParams: Promise<{ q?: string; status?: string; type?: string; removed?: string }> }) {
  const profile = await requireStaff()
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const q = searchParams?.q || '';
  const status = searchParams?.status || '';
  const accountType = searchParams?.type || '';
  const removed = searchParams?.removed || '';

  let query = supabase.from('companies').select('*, owner:profiles!owner_id(full_name)').order('created_at', { ascending: false }).limit(50);
  query = applyCompanyScope(query, profile)
  
  if (q) query = query.ilike('name', `%${q}%`);
  if (status) query = query.eq('status', status);
  if (isCustomerKind(accountType)) query = query.eq('account_type', accountType);

  const wildcardDns = portalDnsMode() === 'vercel'
  const listed = await query;
  let companies = listed.data
  const companyError = listed.error
  if (companyError && /account_type/i.test(companyError.message)) {
    let fallback = supabase.from('companies').select('*, owner:profiles!owner_id(full_name)').order('created_at', { ascending: false }).limit(50);
    fallback = applyCompanyScope(fallback, profile)
    if (q) fallback = fallback.ilike('name', `%${q}%`);
    if (status) fallback = fallback.eq('status', status);
    const retried = await fallback
    companies = retried.data
  }
  const companyRows = asRows<CompanyRow>(companies)
  const ids = companyRows.map((c) => c.id)
  const hostStatusByCompany = new Map<string, string>()
  if (ids.length) {
    const { data: hosts } = await supabase
      .from('portal_hosts')
      .select('company_id, status')
      .in('company_id', ids)
      .eq('role', 'primary')
      .eq('desired', 'parked')
      .neq('status', 'removed')
    for (const row of hosts || []) {
      if (row.company_id) hostStatusByCompany.set(row.company_id, row.status)
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-5 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
              Companies
            </h1>
            <span className="font-mono text-xs text-[#7C766F]">[ {companyRows.length} ]</span>
          </div>
          <p className="mt-1 text-xs text-[#4A4640]">
            Microsite clients, business accounts, and direct customers.
          </p>
        </div>
        <Link
          href="/crm/companies/new"
          className="inline-flex min-h-10 items-center justify-center rounded-none bg-[#1C1B1A] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
        >
          + Add customer
        </Link>
      </div>

      {removed === 'deleted' && (
        <div className="mb-4 px-4 py-3 bg-[#DAE6D3] text-[#3A4537] text-xs border border-[#3A4537]/20 rounded-none">
          Company removed.
        </div>
      )}

      {/* Action Toolbar & Filters */}
      <div className="mb-6 space-y-3 bg-[#FCF9F2] border border-[#CCC5BD] p-3 sm:p-4 rounded-none">
        <form className="flex gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {accountType ? <input type="hidden" name="type" value={accountType} /> : null}
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7C766F]" size={16} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search companies..."
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] py-2 pl-9 pr-4 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </div>
          <button
            type="submit"
            className="min-h-9 shrink-0 rounded-none border border-[#1C1B1A] bg-transparent px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A] transition-colors hover:bg-[#F6F3EC]"
          >
            Search
          </button>
        </form>
        <MobileFilterBar
          pathname="/crm/companies"
          preserveParams={{ ...(q ? { q } : {}), ...(accountType ? { type: accountType } : {}) }}
          fields={[
            {
              key: 'status',
              label: 'Status',
              value: status,
              emptyLabel: 'All statuses',
              options: [
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ],
            },
            {
              key: 'type',
              label: 'Type',
              value: accountType,
              emptyLabel: 'All types',
              options: [
                { value: '', label: 'All types' },
                { value: 'corporate', label: 'Microsite client' },
                { value: 'business', label: 'Business' },
                { value: 'direct', label: 'Direct' },
              ],
            },
          ]}
        />
      </div>

      {companyRows.length > 0 ? (
        <>
          {/* Mobile Card List */}
          <div className="space-y-3 md:hidden">
            {companyRows.map((c: CompanyRow) => {
              const owner = oneRelation(c.owner)
              return (
                <div key={c.id} className="bg-[#FCF9F2] border border-[#CCC5BD] p-4 rounded-none space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/crm/companies/${c.id}`} className="flex items-center gap-3 text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                      <CompanyAvatar name={c.name} logoPath={c.logo_path} size="md" />
                      <div>
                        <div className="font-semibold text-sm leading-tight inline-flex items-center gap-1.5">
                          {c.name}
                          {c.portal_slug ? (
                            <span
                              title={wildcardDns
                                ? `Portal live on wildcard DNS: ${c.portal_slug}`
                                : `Portal ${hostStatusByCompany.get(c.id) || 'pending'}: ${c.portal_slug}`}
                              className={`inline-block h-2 w-2 rounded-full ${wildcardDns ? 'bg-emerald-600' : portalDotClass(hostStatusByCompany.get(c.id))}`}
                            />
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <CustomerKindBadge accountType={c.account_type} isIndividual={c.is_individual} />
                          {c.account_type === 'business' && c.business_verification ? (
                            <span className="text-[10px] uppercase text-[#9E4300]">{c.business_verification}</span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] rounded-none ${
                      c.status === 'active'
                        ? 'bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20'
                        : 'border border-[#CCC5BD] text-[#4A4640] bg-transparent'
                    }`}>
                      {c.status || 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#CCC5BD] text-[#4A4640]">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Industry</span>
                      <span>{c.industry || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">City</span>
                      <span>{c.city || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Owner</span>
                      <span>{owner?.full_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F] block">Created</span>
                      <span className="font-mono">{formatDate(c.created_at)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#CCC5BD] flex items-center justify-end gap-3">
                    <Link href={`/crm/companies/${c.id}`} className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                      View
                    </Link>
                    {(profile.role === 'admin' || profile.role === 'sales') && (
                      <>
                        <span className="text-[#CCC5BD]">·</span>
                        <Link href={`/crm/companies/${c.id}?tab=overview`} className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                          Edit
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-[#FCF9F2] border border-[#CCC5BD] rounded-none overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F6F3EC] border-b border-[#CCC5BD] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
                  <th className="py-3 px-4 font-bold text-left">Company</th>
                  <th className="py-3 px-4 font-bold text-left">Industry</th>
                  <th className="py-3 px-4 font-bold text-left">City</th>
                  <th className="py-3 px-4 font-bold text-left">Owner</th>
                  <th className="py-3 px-4 font-bold text-left">Status</th>
                  <th className="py-3 px-4 font-bold text-left">Created</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companyRows.map((c: CompanyRow) => {
                  const owner = oneRelation(c.owner)
                  return (
                    <tr key={c.id} className="border-b border-[#CCC5BD] hover:bg-[#F6F3EC] transition-colors">
                      <td className="py-2.5 px-4">
                        <Link href={`/crm/companies/${c.id}`} className="flex items-center gap-3 text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                          <CompanyAvatar name={c.name} logoPath={c.logo_path} size="md" />
                          <span className="font-semibold text-sm inline-flex items-center gap-2">
                            {c.name}
                            <CustomerKindBadge accountType={c.account_type} isIndividual={c.is_individual} />
                            {c.account_type === 'business' && c.business_verification ? (
                              <span className="text-[10px] uppercase text-[#9E4300]">{c.business_verification}</span>
                            ) : null}
                            {c.portal_slug ? (
                              <span
                                title={wildcardDns
                                  ? `Portal live on wildcard DNS: ${c.portal_slug}`
                                  : `Portal ${hostStatusByCompany.get(c.id) || 'pending'}: ${c.portal_slug}`}
                                className={`inline-block h-2 w-2 rounded-full ${wildcardDns ? 'bg-emerald-600' : portalDotClass(hostStatusByCompany.get(c.id))}`}
                              />
                            ) : null}
                          </span>
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-[#4A4640]">{c.industry || '—'}</td>
                      <td className="py-2.5 px-4 text-sm text-[#4A4640]">{c.city || '—'}</td>
                      <td className="py-2.5 px-4 text-sm text-[#4A4640]">{owner?.full_name || '—'}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] rounded-none ${
                          c.status === 'active'
                            ? 'bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20'
                            : 'border border-[#CCC5BD] text-[#4A4640] bg-transparent'
                        }`}>
                          {c.status || 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-[#7C766F]">{formatDate(c.created_at)}</td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <Link href={`/crm/companies/${c.id}`} className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                          View
                        </Link>
                        {(profile.role === 'admin' || profile.role === 'sales') && (
                          <>
                            {' '}
                            <span className="text-[#CCC5BD]">·</span>
                            {' '}
                            <Link href={`/crm/companies/${c.id}?tab=overview`} className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:text-[#9E4300] transition-colors">
                              Edit
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="p-12 text-center text-sm text-[#7C766F] bg-[#FCF9F2] border border-[#CCC5BD] rounded-none">
          No companies yet. Add your first company to get started.
        </div>
      )}
    </div>
  );
}
