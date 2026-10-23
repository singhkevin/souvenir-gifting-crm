import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { lineLifecycleEnabled, loadLifecycleSettings } from '@/lib/orders/line-lifecycle-server'
import { saveLifecycleSettings } from '@/app/crm/orders/fulfilment-actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export const dynamic = 'force-dynamic'

const select = 'mt-1 w-full border border-[#D8CFC2] bg-white px-3 py-2'

function YesNo({ name, value, label, help }: { name: string; value: boolean; label: string; help: string }) {
  return (
    <label className="block">
      <span className="text-xs text-[#4A4640]">{label}</span>
      <select name={name} defaultValue={value ? 'yes' : 'no'} className={select}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
      <span className="mt-1 block text-[11px] text-[#7A7267]">{help}</span>
    </label>
  )
}

/** Admin-only switches for the open questions on the order line lifecycle (TODO(client) defaults). */
export default async function OrderLifecycleSettingsPage() {
  await requireStaff(['admin'])
  const supabase = await createClient()
  if (!(await lineLifecycleEnabled(supabase))) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <h1 className="text-xl font-semibold text-[var(--color-primary)]">Order lifecycle settings</h1>
        <p className="mt-2 text-sm text-[#7A7267]">These settings become available once the order line lifecycle update is switched on.</p>
      </div>
    )
  }
  const s = await loadLifecycleSettings(supabase)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-primary)]">Order lifecycle settings</h1>
        <p className="mt-1 text-xs text-[#7A7267]">How product lines move from confirmation to delivery. Changes apply to the next action taken.</p>
      </div>
      <ActionForm action={saveLifecycleSettings} className="space-y-4 border bg-white p-5 text-sm">
        <YesNo name="early_branding_approval" value={s.early_branding_approval} label="Clients may approve the mockup early" help="Lets the client approve before the goods reach the printer, so printing starts sooner." />
        <label className="block">
          <span className="text-xs text-[#4A4640]">When a runner counts short</span>
          <select name="short_count_policy" defaultValue={s.short_count_policy} className={select}>
            <option value="continue">Continue and flag it to operations</option>
            <option value="block">Stop until operations confirms</option>
          </select>
        </label>
        <YesNo name="require_signature" value={s.require_signature} label="Receiver signature required on runner deliveries" help="The runner collects it on the phone screen." />
        <YesNo name="require_seal_photo" value={s.require_seal_photo} label="Seal or signed challan photo required" help="A photo of the stamped challan or company seal." />
        <YesNo name="allow_partial_delivery" value={s.allow_partial_delivery} label="Allow delivering an order in parts" help="Send what is ready now and the rest later." />
        <label className="block">
          <span className="text-xs text-[#4A4640]">Order sources that need branding by default</span>
          <input name="branding_sources" defaultValue={s.branding_sources.join(', ')} className={select} />
          <span className="mt-1 block text-[11px] text-[#7A7267]">Comma separated, e.g. portal, microsite, crm</span>
        </label>
        <label className="block">
          <span className="text-xs text-[#4A4640]">Order sources that ship from stock (skip sourcing and printing)</span>
          <input name="stock_sources" defaultValue={s.stock_sources.join(', ')} className={select} />
        </label>
        <label className="block">
          <span className="text-xs text-[#4A4640]">Raise the supplier payable</span>
          <select name="payable_on" defaultValue={s.payable_on} className={select}>
            <option value="po_sent">When the purchase order is sent</option>
            <option value="manual">Manually from Finance</option>
          </select>
        </label>
        <SubmitButton className="min-h-10 bg-[#806A50] px-4 py-2 text-white" pendingLabel="Saving…">Save</SubmitButton>
      </ActionForm>
    </div>
  )
}
