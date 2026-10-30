import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionForm } from '@/components/ui/action-form'
import { BackButton } from '@/components/ui/back-button'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate, isUuid } from '@/lib/utils'
import { acceptBackorder, convertBackorder, declineBackorder } from '../actions'

type Line = { id: string; product_name: string | null; sku: string | null; quantity: number | null; product_id: string | null }

export default async function BackorderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  await requireStaff(['admin', 'sales', 'operations', 'management'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('store_backorder_requests')
    .select('id, full_name, email, phone, company_name, needed_by, note, notify_opt_in, status, created_at, requirement_id, order_id, lines:store_backorder_lines(id, product_id, product_name, sku, quantity)')
    .eq('id', id)
    .maybeSingle()

  if (error && /store_backorder|schema cache/i.test(error.message)) notFound()
  if (!data) notFound()

  const lines = (data.lines || []) as Line[]
  const open = data.status === 'open' || data.status === 'accepted'
  const declined = data.status === 'declined'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackButton href="/crm/backorders" label="Back to Backorders" />
      <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">{data.status}</p>
        <h1 className="mt-1 font-[family-name:var(--font-newsreader)] text-[32px] font-normal text-[#1C1B1A]">
          {data.full_name}
        </h1>
        <p className="mt-1 text-sm text-[#4A4640]">
          {[data.email, data.phone, data.company_name].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-2 font-mono text-xs text-[#4A4640]">
          {data.needed_by ? `Needed by ${formatDate(data.needed_by)}` : 'No needed-by date'}
          {data.notify_opt_in ? ' · Email when back in stock' : ''}
          {data.created_at ? ` · ${formatDate(data.created_at)}` : ''}
        </p>
        {data.note ? <p className="mt-4 text-sm text-[#1C1B1A]">{data.note}</p> : null}
        {data.notify_opt_in && declined ? (
          <p className="mt-3 text-xs text-[#4A4640]">The customer still gets one email if stock comes back.</p>
        ) : null}
      </div>

      <ul className="divide-y divide-[#CCC5BD] border border-[#CCC5BD]">
        {lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm text-[#1C1B1A]">{line.product_name || 'Item'}</p>
              <p className="font-mono text-xs text-[#7C766F]">{line.sku}</p>
            </div>
            <p className="font-mono text-sm text-[#1C1B1A]">{line.quantity}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3 text-sm">
        {data.requirement_id ? (
          <Link href={`/crm/requirements/${data.requirement_id}`} className="text-[#9E4300] underline">
            Open requirement
          </Link>
        ) : null}
        {data.order_id ? (
          <Link href={`/crm/orders/${data.order_id}`} className="text-[#9E4300] underline">
            In-stock order
          </Link>
        ) : null}
      </div>

      {open ? (
        <div className="flex flex-wrap gap-2">
          {data.status === 'open' ? (
            <ActionForm action={acceptBackorder}>
              <input type="hidden" name="id" value={data.id} />
              <button type="submit" className="bg-[#1C1B1A] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2]">
                Accept
              </button>
            </ActionForm>
          ) : null}
          <ActionForm action={declineBackorder}>
            <input type="hidden" name="id" value={data.id} />
            <button type="submit" className="border border-[#BA1A1A] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#BA1A1A]">
              Decline
            </button>
          </ActionForm>
          <ActionForm action={convertBackorder}>
            <input type="hidden" name="id" value={data.id} />
            <button type="submit" className="border border-[#1C1B1A] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A]">
              Convert to quotation
            </button>
          </ActionForm>
        </div>
      ) : null}
    </div>
  )
}
