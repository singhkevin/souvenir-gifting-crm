import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { OfferingActions } from '../catalogue/OfferingActions'
import { ProductImage } from '@/components/ui/product-image'
import { CatalogueShortlistSection } from '@/components/portal/catalogue-shortlist-section'

export default async function PortalShortlistPage() {
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">My Shortlist</h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Saved gifts from your catalogue and campaign selections.
          </p>
        </div>
        <Link
          href="/portal/requirements/new"
          className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1A3022] px-4 text-sm font-semibold text-white hover:bg-[#274433] sm:w-auto"
        >
          Create Requirement
        </Link>
      </div>

      <CatalogueShortlistSection />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Campaign selections</h2>
          <p className="mt-1 text-sm text-gray-500">Products shortlisted or selected from published campaigns.</p>
        </div>

        {campaignRows.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">No campaign products shortlisted yet.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/portal/catalogue"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1A3022] px-4 text-sm font-semibold text-white hover:bg-[#274433]"
              >
                Browse catalogue
              </Link>
              <Link
                href="/portal/campaigns"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-4 text-sm font-semibold text-[#1A3022] hover:bg-[#FAF7F2]"
              >
                View campaigns
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaignRows.map((row) => {
              const offering = Array.isArray(row.offering) ? row.offering[0] : row.offering
              const campaign = offering && !Array.isArray(offering.campaign) ? offering.campaign : offering?.campaign?.[0]
              if (!offering) return null
              return (
                <div key={row.id} className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <ProductImage src={offering.client_image_url} alt={offering.display_name || 'Gift'} size="md" />
                  <div className="flex flex-1 flex-col space-y-3 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[#1A3022]">{campaign?.name}</p>
                    <Link href={`/portal/catalogue/${offering.id}`}>
                      <h3 className="text-md font-bold text-gray-900 hover:text-[#1A3022]">{offering.display_name}</h3>
                    </Link>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(offering.selling_price)} · qty {row.quantity || 1} · {row.kind}
                    </p>
                    <OfferingActions
                      campaignId={row.campaign_id}
                      campaignProductId={row.campaign_product_id}
                      currentKind={row.kind}
                    />
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
