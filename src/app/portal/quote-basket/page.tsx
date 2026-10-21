import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { CatalogueShortlistSection } from '@/components/portal/catalogue-shortlist-section'
import { offeringPricesForCompany } from '@/lib/catalogs/pricing'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { toggleOfferingSelectionForm } from '@/app/portal/catalogue/actions'

export default async function QuoteBasketPage() {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')
  const { data: rows } = await supabase
    .from('client_product_selections')
    .select('id, kind, quantity, campaign_product_id, campaign_id, offering:campaign_products!inner(id, display_name, client_image_url, selling_price, moq, visibility, campaign:campaigns(name), product:products!inner(status))')
    .eq('company_id', companyId)
    .in('kind', ['shortlisted', 'selected'])
    .eq('offering.visibility', 'published')
    .eq('offering.product.status', 'active')
    .order('updated_at', { ascending: false })

  const campaignRows = rows || []
  const prices = await offeringPricesForCompany(
    campaignRows.flatMap((row) => {
      const offering = Array.isArray(row.offering) ? row.offering[0] : row.offering
      return offering?.id ? [offering.id as string] : []
    }),
    companyId,
  )

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9E4300]">
            REQUISITION BASKET
          </div>
          <h1 className="font-[family-name:var(--font-newsreader)] text-3xl font-normal tracking-tight text-[#1C1C18] sm:text-4xl">
            Quote basket
          </h1>
          <p className="mt-1 text-sm text-[#4A4640] sm:text-base">
            Items you&apos;re considering. Send them as one quote request.
          </p>
        </div>
        <Link
          href="/portal/quotes/new"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-none bg-[#9E4300] px-6 py-3 sv2-label text-[12px] tracking-wider text-white transition-colors hover:bg-[#FF8843] sm:w-auto"
        >
          Request quotation
        </Link>
      </div>

      <CatalogueShortlistSection />

      <section className="space-y-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="border border-[#CCC5BD] bg-[#F1EEE7] px-2.5 py-1 text-[11px] uppercase tracking-wider text-[#9E4300]">
              CATALOG GIFTS
            </span>
            <h2 className="font-[family-name:var(--font-newsreader)] text-2xl font-normal tracking-tight text-[#1C1C18] sm:text-3xl">
              From your catalogs
            </h2>
          </div>
          <p className="mt-1 text-sm text-[#4A4640]">Gifts saved from a catalog.</p>
        </div>

        {campaignRows.length === 0 ? (
          <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-8 text-center sm:p-12">
            <p className="text-xs uppercase tracking-wider text-[#7C766F]">
              No catalog gifts saved yet.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/portal/gifts"
                className="inline-flex min-h-10 items-center justify-center rounded-none bg-[#000000] px-5 py-2.5 sv2-label text-[11px] text-white transition-colors hover:bg-[#9E4300]"
              >
                Browse gifts
              </Link>
              <Link
                href="/portal/gifts?tab=catalogs"
                className="inline-flex min-h-10 items-center justify-center rounded-none border border-[#CCC5BD] bg-transparent px-5 py-2.5 sv2-label text-[11px] text-[#1C1C18] transition-colors hover:border-[#1C1B1A] hover:bg-[#F6F3EC]"
              >
                View catalogs
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {campaignRows.map((row) => {
              const offering = Array.isArray(row.offering) ? row.offering[0] : row.offering
              const campaign =
                offering && !Array.isArray(offering.campaign) ? offering.campaign : offering?.campaign?.[0]
              if (!offering) return null
              return (
                <div
                  key={row.id}
                  className="flex flex-col justify-between overflow-hidden rounded-none border border-[#CCC5BD] bg-[#FCF9F2]"
                >
                  <div className="border-b border-[#CCC5BD]">
                    <ProductImage src={offering.client_image_url} alt={offering.display_name || 'Gift'} size="md" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between space-y-4 p-5">
                    <div>
                      {campaign?.name ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#9E4300]">
                          {campaign.name}
                        </p>
                      ) : null}
                      <Link href={`/portal/gifts/${offering.id}`} className="group block">
                        <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1C18] transition-colors group-hover:text-[#9E4300] sm:text-xl">
                          {offering.display_name}
                        </h3>
                      </Link>
                      <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[#4A4640] sm:text-sm">
                        {formatCurrency(prices.get(offering.id) ?? offering.selling_price)} · qty {row.quantity || 1}
                      </p>
                    </div>
                    <ActionForm action={toggleOfferingSelectionForm} successMessage="Removed">
                      <input type="hidden" name="campaign_id" value={row.campaign_id} />
                      <input type="hidden" name="campaign_product_id" value={row.campaign_product_id} />
                      <input type="hidden" name="kind" value="shortlisted" />
                      <input type="hidden" name="remove" value="1" />
                      <SubmitButton
                        pendingLabel="Removing…"
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-none border border-[#CCC5BD] bg-transparent px-3 py-2 sv2-label text-[11px] text-[#BA1A1A] transition-colors hover:border-[#BA1A1A] hover:bg-[#FFDAD6]/30"
                      >
                        Remove
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
