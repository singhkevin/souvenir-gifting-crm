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
      <div>
        <Link
          href="/business/requests"
          className="inline-flex items-center gap-1.5 sv2-label text-[10px] text-[#7C766F] hover:text-[#9E4300] transition-colors"
        >
          ← Back to requests
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Quote request</p>
            <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">{req.name}</h1>
          </div>
          <span className="inline-block px-3 py-1 sv2-label text-xs uppercase border border-[#CCC5BD] bg-[#F6F3EC] text-[#4A4640]">
            {req.status}
          </span>
        </div>
        <p className="mt-1 sv2-mono-sm text-xs text-[#7C766F]">
          Submitted on {formatDate(req.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#CCC5BD] bg-[#F6F3EC] divide-x divide-y sm:divide-y-0 divide-[#CCC5BD]">
        <div className="p-3.5">
          <p className="sv2-label text-[10px] text-[#7C766F]">Deadline</p>
          <p className="mt-1 sv2-mono-sm text-sm text-[#1C1C18]">
            {req.deadline ? formatDate(req.deadline) : '—'}
          </p>
        </div>
        <div className="p-3.5">
          <p className="sv2-label text-[10px] text-[#7C766F]">Delivery City</p>
          <p className="mt-1 text-sm text-[#1C1C18]">
            {req.delivery_city || '—'}
          </p>
        </div>
        <div className="p-3.5">
          <p className="sv2-label text-[10px] text-[#7C766F]">Budget</p>
          <p className="mt-1 sv2-mono-sm text-sm text-[#1C1C18]">
            {req.budget != null ? formatCurrency(req.budget) : '—'}
          </p>
        </div>
        <div className="p-3.5">
          <p className="sv2-label text-[10px] text-[#7C766F]">Purpose</p>
          <p className="mt-1 text-sm text-[#1C1C18]">
            {req.purpose || '—'}
          </p>
        </div>
      </div>

      {req.description ? (
        <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-4 text-sm text-[#4A4640]">
          <span className="sv2-label text-[10px] text-[#7C766F] block mb-1">Description:</span>
          {req.description}
        </div>
      ) : null}

      <div className="overflow-x-auto border border-[#CCC5BD] bg-[#FCF9F2]">
        <table className="w-full text-left text-sm border-collapse min-w-[540px]">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Item</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Quantity</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Quantity Breaks</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Target Price</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD]">
            {(lines || []).map((line) => {
              const product = oneRelation(line.product as { name?: string; sku?: string } | { name?: string; sku?: string }[] | null)
              const breaks = Array.isArray(line.alt_quantities) ? line.alt_quantities.join(', ') : ''
              return (
                <tr key={line.id} className="hover:bg-[#F6F3EC] transition-colors">
                  <td className="p-3.5">
                    <p className="font-medium text-[#1C1C18]">{product?.name || 'Item'}</p>
                    {product?.sku ? (
                      <p className="sv2-mono-sm text-xs text-[#7C766F]">SKU: {product.sku}</p>
                    ) : null}
                  </td>
                  <td className="p-3.5 sv2-mono-sm text-right text-xs text-[#1C1C18]">
                    {line.quantity}
                  </td>
                  <td className="p-3.5 sv2-mono-sm text-xs text-[#4A4640]">
                    {breaks || '—'}
                  </td>
                  <td className="p-3.5 sv2-mono-sm text-right text-xs text-[#1C1C18]">
                    {line.target_unit_price != null ? formatCurrency(line.target_unit_price) : '—'}
                  </td>
                  <td className="p-3.5 text-xs text-[#4A4640]">
                    {line.notes || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
