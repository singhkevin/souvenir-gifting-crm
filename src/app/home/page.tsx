import type { Metadata } from 'next'
import { SiteShell } from '@/components/site/site-shell'
import { PublicHome } from '@/components/site/public-home'

export const metadata: Metadata = {
  title: 'Souvenir Gifting Solutions — Corporate Gifting, Designed to be Remembered',
  description:
    'Premium corporate gifting catalogue for teams, clients and brands. Browse by category, budget and occasion, then request a quotation.',
  openGraph: {
    title: 'Souvenir Gifting Solutions — Corporate Gifting, Designed to be Remembered',
    description:
      'Premium corporate gifting catalogue for teams, clients and brands. Browse by category, budget and occasion, then request a quotation.',
    type: 'website',
  },
}

export default function HomeAliasPage() {
  return (
    <SiteShell>
      <PublicHome />
    </SiteShell>
  )
}
