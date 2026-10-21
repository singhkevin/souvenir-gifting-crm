import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { isGiftStaffRole } from '@/lib/roles'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { GiftItemPicker, type GiftPickerProduct } from '@/components/gifts/gift-item-picker'
import { createGiftSelection } from '../actions'

export const dynamic = 'force-dynamic'

const inputClass = 'mt-1 w-full border px-3 py-2 text-sm'

export default async function NewGiftSelectionPage() {
  const profile = await requireStaff()
  if (!isGiftStaffRole(profile.role)) {
    return <p className="text-sm text-red-700">You do not have access to gift selection.</p>
  }
  const supabase = await createClient()
  const [{ data: companies }, { data: products }] = await Promise.all([
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('products').select('id, name, sku, image_url').eq('status', 'active').order('name').limit(400),
  ])
  const pickerProducts = (products || []) as GiftPickerProduct[]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/crm/gift-selections" className="text-sm text-gray-500">Gift selection</Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-primary)]">New gift selection</h1>
      </div>
      <ActionForm action={createGiftSelection} className="space-y-4 border bg-white p-4 sm:p-6">
        <label className="block text-xs text-gray-500">
          Company
          <select name="company_id" required className={inputClass} defaultValue="">
            <option value="" disabled>Choose a company</option>
            {(companies || []).map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-500">
          Name
          <input name="name" required placeholder="Diwali gift 2026" className={inputClass} />
        </label>
        <label className="block text-xs text-gray-500">
          Allowed email domains
          <input name="allowed_email_domains" required placeholder="tkion.com" className={inputClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-gray-500">
            Opens (UTC)
            <input type="datetime-local" name="opens_at" required className={inputClass} />
          </label>
          <label className="block text-xs text-gray-500">
            Closes (UTC)
            <input type="datetime-local" name="closes_at" required className={inputClass} />
          </label>
        </div>
        <GiftItemPicker products={pickerProducts} />
        <SubmitButton className="bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white" pendingLabel="Saving…">
          Create gift selection
        </SubmitButton>
      </ActionForm>
    </div>
  )
}
