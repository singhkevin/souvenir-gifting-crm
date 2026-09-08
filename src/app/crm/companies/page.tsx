import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatDate, asRows, oneRelation } from '@/lib/utils';
import { CompanyAvatar } from '@/components/ui/avatar';
import { Search } from 'lucide-react';

import { requireStaff, applyCompanyScope } from '@/lib/auth'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

type CompanyOwner = { full_name: string | null }
type CompanyRow = {
  id: string
  name: string
  logo_path: string | null
  industry: string | null
  city: string | null
  status: string | null
  created_at: string
  owner?: CompanyOwner | CompanyOwner[] | null
}

export default async function Companies(props: { searchParams: Promise<{ q?: string; status?: string; removed?: string }> }) {
  const profile = await requireStaff()
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const q = searchParams?.q || '';
  const status = searchParams?.status || '';
  const removed = searchParams?.removed || '';

  let query = supabase.from('companies').select('*, owner:profiles!owner_id(full_name)').order('created_at', { ascending: false }).limit(50);
  query = applyCompanyScope(query, profile)
  
  if (q) query = query.ilike('name', `%${q}%`);
  if (status) query = query.eq('status', status);

  const { data: companies } = await query;
  const companyRows = asRows<CompanyRow>(companies)

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Companies</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Manage your corporate clients, contacts and account information.
          </p>
        </div>
        <Link
          href="/crm/companies/new"
          className="inline-flex min-h-10 w-full items-center justify-center self-start rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 hover:text-white sm:w-auto"
        >
          Add Company
        </Link>
      </div>

      {removed === 'deleted' && (
        <div className="mb-4 p-3 bg-green-50 text-green-800 text-xs rounded-xl border border-green-200">
          Company removed.
        </div>
      )}

      <div className="mb-6 space-y-3">
        <form className="flex gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input name="q" defaultValue={q} placeholder="Search companies..." className="w-full rounded-md border py-2.5 pl-10 pr-4 text-base sm:py-2 sm:text-sm" />
          </div>
          <button type="submit" className="min-h-10 shrink-0 rounded-md border bg-gray-100 px-4 py-2">Search</button>
        </form>
        <MobileFilterBar
          pathname="/crm/companies"
          preserveParams={q ? { q } : {}}
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
          ]}
        />
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        {companyRows.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-4 font-semibold text-gray-600">Company</th>
                <th className="p-4 font-semibold text-gray-600">Industry</th>
                <th className="p-4 font-semibold text-gray-600">City</th>
                <th className="p-4 font-semibold text-gray-600">Owner</th>
                <th className="p-4 font-semibold text-gray-600">Status</th>
                <th className="p-4 font-semibold text-gray-600">Created</th>
                <th className="p-4 font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {companyRows.map((c: CompanyRow) => {
                const owner = oneRelation(c.owner)
                return (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <Link href={`/crm/companies/${c.id}`} className="flex items-center gap-3 hover:text-[var(--color-primary)]">
                      <CompanyAvatar name={c.name} logoPath={c.logo_path} size="md" />
                      <span className="font-medium">{c.name}</span>
                    </Link>
                  </td>
                  <td className="p-4 text-gray-600">{c.industry || '-'}</td>
                  <td className="p-4 text-gray-600">{c.city || '-'}</td>
                  <td className="p-4 text-gray-600">{owner?.full_name || '—'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">{formatDate(c.created_at)}</td>
                  <td className="p-4">
                    <Link href={`/crm/companies/${c.id}`} className="text-blue-600 hover:underline">View</Link>
                    {(profile.role === 'admin' || profile.role === 'sales') && (
                      <>
                        {' · '}
                        <Link href={`/crm/companies/${c.id}?tab=overview`} className="text-blue-600 hover:underline">Edit</Link>
                      </>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-gray-500">
            No companies yet. Add your first company to get started.
          </div>
        )}
      </div>
    </div>
  );
}