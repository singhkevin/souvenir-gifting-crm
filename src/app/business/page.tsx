import type { Metadata } from 'next'
import { SiteShell } from '@/components/site/site-shell'
import { BusinessHome } from '@/components/site/business-home'
import { appName } from '@/lib/brand'

export const dynamic = 'force-dynamic'

const title = `${appName()} — Corporate gifting`
const description =
  'Browse the corporate catalogue with indicative prices, then request a quotation. Filter by category, brand, price and occasion.'

export const metadata: Metadata = {
  title: { absolute: title },
  description,
}

export default async function BusinessLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <SiteShell>
      <BusinessHome searchParams={params} />
    </SiteShell>
  )
}
