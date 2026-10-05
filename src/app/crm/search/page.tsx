import { createClient } from '@/lib/supabase/server'
import { requireStaff, applyOrderScope, applyOwnerScope, applyCompanyScope } from '@/lib/auth'
import Link from 'next/link'
import { formatCurrency, oneRelation, asRows } from '@/lib/utils'

type SearchLead = {
  id: string
  notes?: string | null
  stage?: string
  company?: { name: string | null } | { name: string | null }[] | null
}
type SearchCompany = { id: string; name: string }
type SearchCampaign = { id: string; name: string }
type SearchRequirement = { id: string; name: string }
type SearchProduct = { id: string; name: string; sku: string | null }
type SearchPerson = { id: string; full_name: string | null; role: string }
type SearchQuote = { id: string; quotation_number: string | null; total: number | null }
type SearchOrder = {
  id: string
  order_number: string | null
  order_value: number | null
  status: string
  company?: { name: string | null } | { name: string | null }[] | null
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const profile = await requireStaff()
  const { q = '' } = await searchParams
  const term = q.trim()
  const supabase = await createClient()

  if (!term) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="font-serif text-2xl">Search</h1>
        <p className="text-sm text-[#7A7267] mt-2">Search only records you are authorized to see.</p>
      </div>
    )
  }

  const like = `%${term}%`
  const canSales = profile.role === 'admin' || profile.role === 'management' || profile.role === 'sales'
  const canOps = profile.role === 'admin' || profile.role === 'management' || profile.role === 'operations'
  const canPeople = profile.role === 'admin' || profile.role === 'management'

  const companyQuery = applyCompanyScope(
    supabase.from('companies').select('id, name').ilike('name', like).limit(8),
    profile
  )
  const reqQuery = applyOwnerScope(
    supabase.from('requirements').select('id, name').ilike('name', like).limit(8),
    profile
  )
  const leadQuery = applyOwnerScope(
    supabase.from('leads').select('id, notes, stage, company:companies(name)').limit(8),
    profile
  )
  const quoteQuery = applyOwnerScope(
    supabase.from('quotations').select('id, quotation_number, total').ilike('quotation_number', `%${term}%`).limit(8),
    profile
  )
  let orderQuery = applyOrderScope(
    supabase.from('orders').select('id, order_number, order_value, status, company:companies(name)').or(`order_number.ilike.${like}`).limit(8),
    profile
  )

  const [{ data: companies }, { data: campaigns }, { data: requirements }, { data: products }, { data: people }, { data: leads }, { data: quotations }, ordersRes] = await Promise.all([
    canSales || profile.role === 'accounts' || profile.role === 'operations' ? companyQuery : Promise.resolve({ data: [] as SearchCompany[] }),
    canSales ? supabase.from('campaigns').select('id, name').ilike('name', like).limit(8) : Promise.resolve({ data: [] as SearchCampaign[] }),
    canSales ? reqQuery : Promise.resolve({ data: [] as SearchRequirement[] }),
    (canSales || canOps)
      ? supabase.from('products').select('id, name, sku').or(`name.ilike.${like},sku.ilike.${like}`).limit(8)
      : Promise.resolve({ data: [] as SearchProduct[] }),
    canPeople
      ? supabase.from('profiles').select('id, full_name, email, role').or(`full_name.ilike.${like},email.ilike.${like}`).in('role', ['admin', 'sales', 'operations', 'accounts', 'management']).limit(8)
      : Promise.resolve({ data: [] as SearchPerson[] }),
    canSales ? leadQuery : Promise.resolve({ data: [] as SearchLead[] }),
    canSales ? quoteQuery : Promise.resolve({ data: [] as SearchQuote[] }),
    orderQuery,
  ])
  const orders = asRows<SearchOrder>(ordersRes.data)

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="bg-white border rounded-2xl p-4 space-y-2">
      <h2 className="text-xs uppercase tracking-wider text-[#7A7267] font-semibold">{title}</h2>
      {children}
    </section>
  )

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-4">
      <h1 className="font-serif text-2xl">Results for “{term}”</h1>
      <Section title="Orders">
        {(orders || []).map((o: SearchOrder) => {
          const company = oneRelation(o.company)
          return (
            <Link key={o.id} href={`/crm/orders/${o.id}`} className="block text-sm hover:underline">
              {o.order_number} · {company?.name} · {formatCurrency(o.order_value)}
            </Link>
          )
        })}
        {(!orders || orders.length === 0) && <p className="text-sm text-gray-500">No orders.</p>}
      </Section>
      {canSales && (
        <Section title="Leads">
          {(leads || []).map((l: SearchLead) => {
            const company = oneRelation(l.company)
            return (
              <Link key={l.id} href={`/crm/leads/${l.id}`} className="block text-sm hover:underline">
                {company?.name || 'Lead'} · {l.stage}
              </Link>
            )
          })}
          {(!leads || leads.length === 0) && <p className="text-sm text-gray-500">No leads.</p>}
        </Section>
      )}
      {canSales && (
        <Section title="Quotations">
          {(quotations || []).map((quote: SearchQuote) => (
            <Link key={quote.id} href={`/crm/quotations/${quote.id}`} className="block text-sm hover:underline">
              {quote.quotation_number} · {formatCurrency(quote.total)}
            </Link>
          ))}
          {(!quotations || quotations.length === 0) && <p className="text-sm text-gray-500">No quotations.</p>}
        </Section>
      )}
      <Section title="Clients">
        {(companies || []).map((c: SearchCompany) => (
          <Link key={c.id} href={`/crm/companies/${c.id}`} className="block text-sm hover:underline">{c.name}</Link>
        ))}
        {(!companies || companies.length === 0) && <p className="text-sm text-gray-500">No companies.</p>}
      </Section>
      {canSales && (
        <Section title="Catalogs">
          {(campaigns || []).map((c: SearchCampaign) => (
            <Link key={c.id} href={`/crm/catalogs/${c.id}`} className="block text-sm hover:underline">{c.name}</Link>
          ))}
          {(!campaigns || campaigns.length === 0) && <p className="text-sm text-gray-500">No catalogs.</p>}
        </Section>
      )}
      {canSales && (
        <Section title="Requirements">
          {(requirements || []).map((r: SearchRequirement) => (
            <Link key={r.id} href={`/crm/requirements/${r.id}`} className="block text-sm hover:underline">{r.name}</Link>
          ))}
          {(!requirements || requirements.length === 0) && <p className="text-sm text-gray-500">No requirements.</p>}
        </Section>
      )}
      {(canSales || canOps) && (
        <Section title="Products">
          {(products || []).map((p: SearchProduct) => (
            <Link key={p.id} href={`/crm/products/${p.id}`} className="block text-sm hover:underline">{p.name} · {p.sku}</Link>
          ))}
          {(!products || products.length === 0) && <p className="text-sm text-gray-500">No products.</p>}
        </Section>
      )}
      {canPeople && (
        <Section title="People">
          {(people || []).map((p: SearchPerson) => (
            <p key={p.id} className="text-sm">{p.full_name} · {p.role}</p>
          ))}
          {(!people || people.length === 0) && <p className="text-sm text-gray-500">No people.</p>}
        </Section>
      )}
    </div>
  )
}
