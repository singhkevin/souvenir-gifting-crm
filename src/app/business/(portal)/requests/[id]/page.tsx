import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BusinessRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { company, profile } = await requireBusiness()
  const supabase = await createClient()
  const { data: req } = await supabase
    .from('requirements')
    .select('id, name, status, created_at, deadline, delivery_city, budget, purpose, description, company_id, source')
    .eq('id', id)
    .maybeSingle()
  if (!req || req.company_id !== (company?.id || profile.company_id)) notFound()
  if (req.source && req.source !== 'business_portal') notFound()

  const { data: lines } = await supabase
    .from('requirement_products')
    .select('id, quantity, notes, target_unit_price, alt_quantities, product:products(name, sku)')
    .eq('requirement_id', id)

  return (
    <div className="space-y-6">
      <Link href="/business/requests" className="text-xs uppercase tracking-[0.14em] text-[#806A50]">Requests</Link>
      <div>
        <h1 className="font-serif text-3xl">{req.name}</h1>
        <p className="mt-2 text-sm capitalize text-[#5C6570]">{req.status} · {formatDate(req.created_at)}</p>
      </div>
      <div className="grid gap-2 text-sm text-[#5C6570] sm:grid-cols-2">
        <p>Deadline: {req.deadline ? formatDate(req.deadline) : '—'}</p>
        <p>City: {req.delivery_city || '—'}</p>
        <p>Budget: {req.budget != null ? formatCurrency(req.budget) : '—'}</p>
        <p>Purpose: {req.purpose || '—'}</p>
      </div>
      {req.description ? <p className="text-sm text-[#5C6570]">{req.description}</p> : null}
      <ul className="divide-y divide-[#E8E4DE] rounded-lg border border-[#E8E4DE] bg-white">
        {(lines || []).map((line) => {
          const product = oneRelation(line.product as { name?: string; sku?: string } | { name?: string; sku?: string }[] | null)
          const breaks = Array.isArray(line.alt_quantities) ? line.alt_quantities.join(', ') : ''
          return (
            <li key={line.id} className="px-4 py-3 text-sm">
              <p className="font-medium">{product?.name || 'Item'}</p>
              <p className="text-xs text-[#5C6570]">{product?.sku} · Qty {line.quantity}</p>
              {breaks ? <p className="text-xs text-[#5C6570]">Breaks: {breaks}</p> : null}
              {line.target_unit_price != null ? <p className="text-xs text-[#5C6570]">Target {formatCurrency(line.target_unit_price)}</p> : null}
              {line.notes ? <p className="text-xs text-[#5C6570]">{line.notes}</p> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
