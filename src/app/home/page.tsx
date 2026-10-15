import { Suspense } from 'react'
import type { Metadata } from 'next'
import { appName } from '@/lib/brand'
import { SiteShell } from '@/components/site/site-shell'
import { PublicHome } from '@/components/site/public-home'
import { RetailHomeSkeleton } from '@/components/site/retail-hero'

const title = `${appName()} — Gifts for every occasion`
const description =
  'Curated gifts, designed to be remembered. Browse by category, budget and occasion, then order what you love.'

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: {
    title,
    description,
    siteName: appName(),
    url: '/home',
    type: 'website',
  },
}

export default async function HomeAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <SiteShell>
      <Suspense fallback={<RetailHomeSkeleton />}>
        <PublicHome searchParams={params} basePath="/home" />
      </Suspense>
    </SiteShell>
  )
}
