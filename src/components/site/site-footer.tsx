import Image from 'next/image'
import Link from 'next/link'
import { appName, appShortName, marketingHostLabel, marketingSiteUrl } from '@/lib/brand'
import { BUDGET_BANDS } from '@/lib/catalogue/collections'
import { siteContent } from '@/config/siteContent'
import { whatsAppHref } from '@/lib/contact/public-phone'

export function SiteFooter({
  workspaceHref,
  workspaceLabel,
  phone,
}: {
  workspaceHref?: string | null
  workspaceLabel?: string | null
  phone?: string | null
}) {
  const currentYear = new Date().getFullYear()
  const displayPhone = phone || siteContent.phone
  const marketingUrl = marketingSiteUrl()
  const marketingHost = marketingHostLabel(marketingUrl)
  const whatsApp = phone ? whatsAppHref(phone) : null

  return (
    <footer className="w-full border-t border-[#CCC5BD] bg-[#F6F3EC] px-4 sm:px-8 lg:px-16 py-12 lg:py-16 text-[#1C1C18]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 pb-12 border-b border-[#CCC5BD]">
        {/* Col 1: Brand & Overview */}
        <div className="space-y-4">
          <Link href="/home" className="inline-block">
            <Image src="/logo.png" alt={appName()} width={140} height={44} className="h-8 w-auto object-contain" />
          </Link>
          <p className="sv2-body-sm text-[#4A4640]">
            {appName()} — Gifts, hampers, and keepsakes for personal celebrations, teams, and clients across India.
          </p>
          <div className="sv2-mono-sm text-[#7C766F] space-y-1 pt-1">
            <div>GSTIN: {siteContent.gstin}</div>
            <div>CIN: {siteContent.cin}</div>
          </div>
        </div>

        {/* Col 2: Locations & Contact */}
        <div>
          <h4 className="sv2-label text-[#1C1C18] mb-3">
            ADDRESS &amp; CONTACT
          </h4>
          <div className="space-y-3 sv2-body-sm text-[#4A4640]">
            <div>
              <strong className="text-[#1C1C18] block font-medium">Registered Office</strong>
              <span>{siteContent.registeredAddress}</span>
            </div>
            <div>
              <strong className="text-[#1C1C18] block font-medium">Studio &amp; Fulfilment</strong>
              <span>{siteContent.studioAddress}</span>
            </div>
            <div className="pt-1 sv2-mono-sm text-[#7C766F] space-y-1">
              <div>
                Phone:{' '}
                {phone ? (
                  <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-[#1C1C18] hover:text-[#9E4300]">
                    {phone}
                  </a>
                ) : (
                  <span>{displayPhone}</span>
                )}
              </div>
              <div>
                WhatsApp:{' '}
                {whatsApp ? (
                  <a href={whatsApp} target="_blank" rel="noopener noreferrer" className="text-[#1C1C18] hover:text-[#9E4300]">
                    {displayPhone}
                  </a>
                ) : (
                  <span>{siteContent.whatsapp}</span>
                )}
              </div>
              <div>Email: {siteContent.email}</div>
            </div>
          </div>
        </div>

        {/* Col 3: Shop & Collections */}
        <div>
          <h4 className="sv2-label text-[#1C1C18] mb-3">
            SHOP &amp; COLLECTIONS
          </h4>
          <ul className="space-y-2 sv2-body-sm text-[#4A4640]">
            <li>
              <Link href="/catalogue" className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors">
                Catalogue
              </Link>
            </li>
            <li>
              <Link href="/collections" className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors">
                Collections
              </Link>
            </li>
            <li>
              <Link href="/categories" className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors">
                Categories
              </Link>
            </li>
            <li>
              <Link href="/collections#occasions" className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors">
                Shop by Occasion
              </Link>
            </li>
            <li>
              <Link href="/request-quote" className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors">
                Request a Quote
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 4: About & Price Bands */}
        <div>
          <h4 className="sv2-label text-[#1C1C18] mb-3">
            ASSISTANCE &amp; PRICING
          </h4>
          <ul className="space-y-2 sv2-body-sm text-[#4A4640]">
            <li>
              <Link href="/about" className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors">
                About {appShortName()}
              </Link>
            </li>
            <li>
              <Link href="/business" className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors">
                Corporate Desk (/business)
              </Link>
            </li>
            {workspaceHref && workspaceLabel ? (
              <li>
                <Link href={workspaceHref} className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors">
                  {workspaceLabel}
                </Link>
              </li>
            ) : (
              <li>
                <Link href="/login" className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors">
                  Account / Team Login
                </Link>
              </li>
            )}
            {BUDGET_BANDS.map((band) => (
              <li key={band.id}>
                <Link
                  href={`/catalogue?budget=${encodeURIComponent(band.id)}`}
                  className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors"
                >
                  {band.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Copyright & Integrity Bar */}
      <div className="max-w-7xl mx-auto pt-4 flex flex-col sm:flex-row items-center justify-between sv2-body-sm text-xs text-[#7C766F] gap-2">
        <p>
          &copy; {currentYear} {appName()}. All rights reserved.
        </p>
        <div className="flex items-center gap-4 sv2-mono-sm">
          <span>{siteContent.utilityBar.gstNote}</span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">GSTIN: {siteContent.gstin}</span>
          {marketingUrl && marketingHost ? (
            <>
              <span className="hidden md:inline">|</span>
              <a href={marketingUrl} className="hover:text-[#1C1C18]">
                {marketingHost}
              </a>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
