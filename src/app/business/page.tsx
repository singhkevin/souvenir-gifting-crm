import type { Metadata } from 'next'
import { BusinessHome } from '@/components/site/business-home'
import { appName } from '@/lib/brand'
import { newsreader, plusJakarta, jetbrainsMono } from '@/lib/fonts'
import '@/app/sv2.css'

export const dynamic = 'force-dynamic'

const title = `${appName()} — Corporate gifts for teams and clients`
const description =
  'Browse corporate gifts with indicative prices, filter by occasion, category and budget, then request a quotation.'

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: {
    title,
    description,
    url: '/business',
    siteName: appName(),
    locale: 'en_IN',
    type: 'website',
    images: [
      {
        url: '/site/hero-composition.webp',
        width: 1200,
        height: 630,
        alt: `${appName()} — Corporate gifts for teams and clients`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/site/hero-composition.webp'],
  },
}

export default async function BusinessLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <div
      className={`sv2 ${newsreader.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} min-h-screen bg-[#FCF9F2] text-[#1C1C18]`}
    >
      <BusinessHome searchParams={params} />
    </div>
  )
}
