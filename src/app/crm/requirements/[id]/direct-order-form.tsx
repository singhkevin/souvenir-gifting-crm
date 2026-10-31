import { createOrderFromRequirement } from '../direct-order-action'
import { DIRECT_ORDER_GST_PERCENT } from '@/lib/orders/direct-order'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export function DirectOrderForm({
  requirementId,
  lines,
}: {
  requirementId: string
  lines: {
    productId: string
    name: string
    sku: string | null
    quantity: number
    unitPrice: number | null
  }[]
}) {
  if (!lines.length) return null
  return (
    <section id="create-order-directly" className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4 space-y-3">
      <div>
        <h2 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1C18]">
          Create order directly
        </h2>
        <p className="mt-1 text-xs text-[#4A4640]">
          For an order already agreed offline, by phone, or as a repeat. This skips creating, sending, and accepting a quotation.
          Confirm the sell price on each line. Quantities stay as they are on the Products tab. Line amounts are ex-GST. GST ({DIRECT_ORDER_GST_PERCENT}%) is added once.
        </p>
      </div>
      <ActionForm action={createOrderFromRequirement} className="space-y-3">
        <input type="hidden" name="requirement_id" value={requirementId} />
        <div className="overflow-x-auto border border-[#CCC5BD]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <tr>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Product</th>
                <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Qty</th>
                <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Sell price ex-GST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CCC5BD]">
              {lines.map((line) => (
                <tr key={line.productId}>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[#1C1C18]">{line.name}</div>
                    {line.sku ? <div className="font-mono text-[11px] text-[#7C766F]">{line.sku}</div> : null}
                    <input type="hidden" name="product_id" value={line.productId} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[#1C1C18]">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      name={`unit_price_${line.productId}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      defaultValue={line.unitPrice == null ? '' : line.unitPrice}
                      aria-label={`Sell price for ${line.name}`}
                      className="w-28 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1.5 text-right font-mono text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SubmitButton
          className="inline-flex items-center rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors"
          pendingLabel="Creating…"
        >
          Create order directly
        </SubmitButton>
      </ActionForm>
    </section>
  )
}
