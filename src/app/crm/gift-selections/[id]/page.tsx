import { GIFT_STAFF_ROLES } from '@/lib/roles'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { isGiftStaffRole } from '@/lib/roles'
import { formatDateTime, isUuid } from '@/lib/utils'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { GiftItemPicker, type GiftPickerProduct } from '@/components/gifts/gift-item-picker'
import { countGiftChoices } from '@/lib/gifts/export'
import { giftJoinUrl } from '@/lib/gifts/company'
import { giftWindowOpen } from '@/lib/gifts/rules'
import { resetGiftSubmission, updateGiftSelection } from '../actions'
import { ProductThumb } from '@/components/ui/product-thumb'

export const dynamic = 'force-dynamic'

function toLocalInput(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

export default async function GiftSelectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const profile = await requireStaff([...GIFT_STAFF_ROLES]) // is_gift_staff in the RLS
  if (!isGiftStaffRole(profile.role)) {
    return <p className="text-sm text-red-700">You do not have access to gift selection.</p>
  }
  const supabase = await createClient()
  const { data: selection } = await supabase
    .from('gift_selections')
    .select('id, name, company_id, allowed_email_domains, opens_at, closes_at, company:companies(name, portal_slug)')
    .eq('id', id)
    .maybeSingle()
  if (!selection) notFound()

  const [{ data: items }, { data: submissions }, { data: products }, { data: comboRows }] = await Promise.all([
    supabase
      .from('gift_selection_items')
      .select('id, kind, product_id, title, image_url, member_names, size_options, sort_order')
      .eq('selection_id', id)
      .order('sort_order'),
    supabase
      .from('gift_selection_submissions')
      .select('id, employee_name, employee_email, selected_label, size, address, city, state, pin, phone, submitted_at')
      .eq('selection_id', id)
      .order('submitted_at'),
    supabase.from('products').select('id, name, sku, image_url').eq('status', 'active').order('name').limit(400),
    supabase.from('gift_selection_combo_products').select('item_id, product_id, sort_order'),
  ])

  const company = Array.isArray(selection.company) ? selection.company[0] : selection.company
  const locked = (submissions || []).length > 0
  const counts = countGiftChoices(
    (submissions || []).map((row) => ({ label: row.selected_label, size: row.size })),
  )
  // Submissions store the chosen item's title; match it back to that item's picture.
  const imageByLabel = new Map((items || []).map((item) => [item.title as string, (item.image_url as string | null) || null]))
  const open = giftWindowOpen(selection.opens_at, selection.closes_at)
  const initial = (items || []).map((item) => ({
    key: item.id,
    kind: item.kind as 'product' | 'combo',
    productId: item.product_id,
    productIds: (comboRows || [])
      .filter((row) => row.item_id === item.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => row.product_id),
    title: item.title,
    imageUrl: item.image_url,
    memberNames: item.member_names || [],
    sizes: (item.size_options || []).join(', '),
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link href="/crm/gift-selections" className="text-sm text-gray-500">Gift selection</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-primary)]">{selection.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {company?.name || 'Company'} · {open ? 'Open' : 'Closed'} · {(submissions || []).length} submitted
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <a className="border px-3 py-2" href={`/crm/gift-selections/${id}/export?format=csv`}>CSV</a>
            <a className="border px-3 py-2" href={`/crm/gift-selections/${id}/export?format=xls`}>Excel</a>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Employee link: <span className="font-medium">{giftJoinUrl(company?.portal_slug || null)}</span>
        </p>
      </div>

      <ActionForm action={updateGiftSelection} className="space-y-4 border bg-white p-4 sm:p-6">
        <input type="hidden" name="id" value={selection.id} />
        <label className="block text-xs text-gray-500">
          Name
          <input name="name" defaultValue={selection.name} required className="mt-1 w-full border px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs text-gray-500">
          Allowed email domains
          <input
            name="allowed_email_domains"
            defaultValue={(selection.allowed_email_domains || []).join(', ')}
            required
            className="mt-1 w-full border px-3 py-2 text-sm"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-gray-500">
            Opens (UTC)
            <input type="datetime-local" name="opens_at" defaultValue={toLocalInput(selection.opens_at)} required className="mt-1 w-full border px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs text-gray-500">
            Closes (UTC)
            <input type="datetime-local" name="closes_at" defaultValue={toLocalInput(selection.closes_at)} required className="mt-1 w-full border px-3 py-2 text-sm" />
          </label>
        </div>
        {locked ? (
          <p className="text-sm text-gray-500">The gift list stays as submitted. Reset a choice before replacing the shortlist.</p>
        ) : (
          <GiftItemPicker products={(products || []) as GiftPickerProduct[]} initial={initial} />
        )}
        <SubmitButton className="bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </ActionForm>

      <section className="border bg-white p-4">
        <h2 className="text-sm font-semibold">Counts</h2>
        {counts.length === 0 ? <p className="mt-2 text-sm text-gray-500">No submissions yet.</p> : (
          <ul className="mt-3 divide-y text-sm">
            {counts.map((row) => (
              <li key={`${row.label}-${row.size}`} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-3">
                  <ProductThumb src={imageByLabel.get(row.label)} alt={row.label} />
                  <span>{row.label}{row.size !== '—' ? ` · ${row.size}` : ''}</span>
                </span>
                <span className="font-medium">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-x-auto border bg-white">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {['Employee Name', 'Email', 'Selected Product', 'Variant/Size', 'Address', 'City', 'State', 'PIN', 'Phone', ''].map((label) => (
                <th key={label || 'reset'} className="px-3 py-3">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(submissions || []).map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-3">{row.employee_name}</td>
                <td className="px-3 py-3">{row.employee_email}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <ProductThumb src={imageByLabel.get(row.selected_label)} alt={row.selected_label} />
                    <span>{row.selected_label}</span>
                  </div>
                </td>
                <td className="px-3 py-3">{row.size || '—'}</td>
                <td className="px-3 py-3">{row.address}</td>
                <td className="px-3 py-3">{row.city}</td>
                <td className="px-3 py-3">{row.state}</td>
                <td className="px-3 py-3">{row.pin}</td>
                <td className="px-3 py-3">{row.phone}</td>
                <td className="px-3 py-3">
                  <ConfirmAction
                    title="Reset this choice?"
                    confirmLabel="Reset"
                    action={resetGiftSubmission}
                    hiddenFields={{ id: row.id, selection_id: id }}
                    description={<p>{row.employee_name} can choose again.</p>}
                  >
                    Reset
                  </ConfirmAction>
                  <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(row.submitted_at)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
