import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { StoreCard, StorePageHeader } from '@/components/site/store-ui'
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
      <StorePageHeader
        eyebrow="Checkout"
        title="Quoted checkout"
        lede="A locked quotation. Stock and catalogue flags are not rechecked."
      />
      <div className="mx-auto max-w-lg px-4 py-12">
        {!view.ok ? (
          <p className="text-sm text-[#4d453e]">
            {view.reason === 'used'
              ? 'This checkout link has already been used.'
              : view.reason === 'expired'
                ? 'This checkout link has expired.'
                : 'This checkout link is not valid.'}
          </p>
        ) : (
          <StoreCard className="space-y-4 p-5">
            <p className="text-sm text-[#4d453e]">
              {view.quotationNumber} is locked at the quoted price.
            </p>
            <ul className="divide-y divide-[#eadfd4] border-y border-[#eadfd4]">
              {view.lines.map((line) => (
                <li key={`${line.sku}-${line.name}`} className="flex justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="block">{line.name}</span>
                    <span className="text-xs text-[#4d453e]">{line.sku} · {line.quantity} × {formatCurrency(line.unitPrice)}</span>
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
            <Link href="/catalogue" className="block text-center text-xs font-semibold text-[#735c00]">Back to the catalogue</Link>
          </StoreCard>
        )}
      </div>
    </SiteShell>
  )
}
