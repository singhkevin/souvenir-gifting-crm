import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { OfferingActions } from '../OfferingActions'
import { formatCurrency } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'

export default async function CampaignOfferingDetailPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: offering } = await supabase
    .from('campaign_products')
    .select('id, display_name, client_description, client_image_url, selling_price, pack_kit_total, moq, pack_kit_id, pack_kit_role, campaign_id, personalization_options, estimated_delivery, campaign:campaigns(id, name), product:products!inner(status)')
    .eq('id', sku)
    .eq('visibility', 'published')
    .eq('product.status', 'active')
    .maybeSingle()

  if (!offering) notFound()

  let kitMembers: { id: string; display_name: string | null; selling_price: number | null }[] = []
  if (offering.pack_kit_id && offering.pack_kit_role === 'primary') {
    const { data: lines } = await supabase
      .from('campaign_products')
      .select('id, display_name, selling_price, display_order')
      .eq('pack_kit_id', offering.pack_kit_id)
      .eq('visibility', 'published')
      .order('display_order')
    kitMembers = lines || []
  }
  const kitTotal =
    offering.pack_kit_total != null ? Number(offering.pack_kit_total) : offering.selling_price

  const campaign = Array.isArray(offering.campaign) ? offering.campaign[0] : offering.campaign
  const { data: selection } = await supabase
    .from('client_product_selections')
    .select('kind')
    .eq('campaign_product_id', offering.id)
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton href={`/portal/catalogue?campaign=${offering.campaign_id}`} label="Back to campaign products" />

      <div className="grid grid-cols-1 gap-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 md:grid-cols-2 md:gap-8">
        <ProductImage src={offering.client_image_url} alt={offering.display_name || 'Gift'} size="hero" className="min-h-[240px] rounded-xl border border-gray-100 sm:min-h-[300px]" />

        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-[#806A50]">{campaign?.name}</p>
            <h1 className="text-2xl font-bold text-gray-900">{offering.display_name}</h1>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(kitTotal)}</p>
              <p className="mt-1 text-xs text-gray-500">
                {kitMembers.length > 1 ? 'Combined kit price per person' : `Minimum order quantity: ${offering.moq || 1} units`}
              </p>
            </div>
            {kitMembers.length > 1 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-800">What&apos;s in this kit</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  {kitMembers.map((line) => (
                    <li key={line.id} className="flex justify-between gap-2">
                      <span>{line.display_name}</span>
                      <span className="font-medium">{formatCurrency(line.selling_price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm leading-relaxed text-gray-600">
              {offering.client_description || 'Custom corporate gifting product with branding options.'}
            </p>
            {offering.personalization_options && (
              <p className="text-xs text-gray-500">Personalization: {offering.personalization_options}</p>
            )}
            {offering.estimated_delivery && (
              <p className="text-xs text-gray-500">Estimated delivery: {offering.estimated_delivery}</p>
            )}
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-4">
            <OfferingActions
              campaignId={offering.campaign_id}
              campaignProductId={offering.id}
              currentKind={selection?.kind || null}
            />
            <Link
              href="/portal/requirements/new"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#806A50] px-4 text-xs font-semibold text-[#FFFFFF] hover:bg-[#9C8567]"
            >
              Request a quotation
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
