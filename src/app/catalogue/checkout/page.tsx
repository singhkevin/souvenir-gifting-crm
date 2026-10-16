import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { CartCheckout } from '@/components/site/cart-checkout'
import { loadQuoteCheckout } from '@/lib/business/quote-checkout'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function QuoteCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string }>
}) {
  const { quote = '' } = await searchParams
  const view = quote ? await loadQuoteCheckout(quote) : { ok: false as const, reason: 'invalid' as const }

  return (
    <SiteShell>
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="font-serif text-3xl">Quoted checkout</h1>
        {!view.ok ? (
          <p className="mt-4 text-sm text-[#5C6570]">
            {view.reason === 'used'
              ? 'This checkout link has already been used.'
              : view.reason === 'expired'
                ? 'This checkout link has expired.'
                : 'This checkout link is not valid.'}
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-[#5C6570]">
              {view.quotationNumber} is locked at the quoted price. Stock and catalogue flags are not rechecked.
            </p>
            <ul className="divide-y divide-[#E8E4DE] border-y border-[#E8E4DE]">
              {view.lines.map((line) => (
                <li key={`${line.sku}-${line.name}`} className="flex justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="block">{line.name}</span>
                    <span className="text-xs text-[#5C6570]">{line.sku} · {line.quantity} × {formatCurrency(line.unitPrice)}</span>
                  </span>
                  <span>{formatCurrency(line.quantity * line.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm font-semibold">Total {formatCurrency(view.total)}</p>
            <CartCheckout
              items={[]}
              kind="store"
              quoteLock={view}
              onDone={() => undefined}
            />
            <Link href="/catalogue" className="block text-center text-xs text-[#5C6570]">Back to the catalogue</Link>
          </div>
        )}
      </div>
    </SiteShell>
  )
}
