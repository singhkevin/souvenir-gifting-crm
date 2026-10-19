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
      <div className="store-container max-w-lg py-12 sm:py-16">
        <p className="store-eyebrow">Checkout</p>
        <h1 className="store-section-title mt-2">Quoted checkout</h1>
        {!view.ok ? (
          <div className="mt-6 border border-error bg-error-bg px-4 py-4 text-sm text-error" role="alert">
            {view.reason === 'used'
              ? 'This checkout link has already been used.'
              : view.reason === 'expired'
                ? 'This checkout link has expired.'
                : 'This checkout link is not valid.'}
          </div>
        ) : (
          <div className="mt-6 space-y-4 rounded border border-cream-border bg-cream-card p-5 shadow-sm">
            <p className="text-sm text-ink-secondary">
              {view.quotationNumber} is locked at the quoted price. Stock and catalogue flags are not rechecked.
            </p>
            <ul className="divide-y divide-cream-border border-y border-cream-border">
              {view.lines.map((line) => (
                <li key={`${line.sku}-${line.name}`} className="flex justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="block text-ink">{line.name}</span>
                    <span className="font-mono text-xs text-ink-secondary">{line.sku} · {line.quantity} × {formatCurrency(line.unitPrice)}</span>
                  </span>
                  <span className="store-price text-sm">{formatCurrency(line.quantity * line.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm">
              <span className="text-ink-secondary">Total </span>
              <span className="store-price">{formatCurrency(view.total)}</span>
            </p>
            <CartCheckout
              items={[]}
              kind="store"
              quoteLock={view}
              onDone={() => undefined}
            />
            <Link href="/catalogue" className="block text-center text-xs text-ink-secondary">Back to the catalogue</Link>
          </div>
        )}
      </div>
    </SiteShell>
  )
}
