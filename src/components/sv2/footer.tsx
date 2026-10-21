import Link from 'next/link'
import { siteContent } from '@/config/siteContent'
import { appName, appShortName } from '@/lib/brand'

/**
 * SV2 Footer — 4-column layout with hairline borders,
 * business details strictly from siteContent placeholders,
 * and computed current-year copyright.
 */
export function SV2Footer({ phone }: { phone?: string | null }) {
  const currentYear = new Date().getFullYear()
  const displayPhone = phone || siteContent.phone

  return (
    <footer className="w-full border-t border-[#CCC5BD] bg-[#F6F3EC] px-4 sm:px-8 lg:px-16 py-12 lg:py-16">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 pb-12 border-b border-[#CCC5BD]">
        {/* Col 1: Brand & Overview */}
        <div className="space-y-4">
          <span className="sv2-headline-sm tracking-tight text-[#1C1C18] uppercase font-bold block">
            {appShortName()}
          </span>
          <p className="sv2-body-sm text-[#4A4640]">
            {appName()} — Corporate gifts with indicative prices, sample ordering, and custom branding for teams and clients across India.
          </p>
          <div className="sv2-mono-sm text-[#7C766F] space-y-1 pt-1">
            <div>GSTIN: {siteContent.gstin}</div>
            <div>CIN: {siteContent.cin}</div>
          </div>
        </div>

        {/* Col 2: Locations & Contact */}
        <div>
          <h4 className="sv2-label text-[#1C1C18] mb-3">
            // ADDRESS &amp; CONTACT
          </h4>
          <div className="space-y-3 sv2-body-sm text-[#4A4640]">
            <div>
              <strong className="text-[#1C1C18] block font-medium">Registered Office</strong>
              <span>{siteContent.registeredAddress}</span>
            </div>
            <div>
              <strong className="text-[#1C1C18] block font-medium">Warehouse &amp; Fulfillment</strong>
              <span>{siteContent.studioAddress}</span>
            </div>
            <div className="pt-1 sv2-mono-sm text-[#7C766F] space-y-1">
              <div>Phone: {displayPhone}</div>
              <div>WhatsApp: {siteContent.whatsapp}</div>
              <div>Email: {siteContent.email}</div>
            </div>
          </div>
        </div>

        {/* Col 3: Direct Procurement Links */}
        <div>
          <h4 className="sv2-label text-[#1C1C18] mb-3">
            // PROCUREMENT
          </h4>
          <ul className="space-y-2 sv2-body-sm text-[#4A4640]">
            <li>
              <Link
                href="/catalogue"
                className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors"
              >
                Corporate Catalogue
              </Link>
            </li>
            <li>
              <Link
                href="#catalog"
                className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors"
              >
                Occasion Kits &amp; Hampers
              </Link>
            </li>
            <li>
              <Link
                href="/business/quote"
                className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors"
              >
                Sample Cart &amp; Shortlist
              </Link>
            </li>
            <li>
              <Link
                href="/request-quote"
                className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors"
              >
                Request a Quotation
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 4: Legal & Direct Access */}
        <div>
          <h4 className="sv2-label text-[#1C1C18] mb-3">
            // COMPLIANCE &amp; LEGAL
          </h4>
          <ul className="space-y-2 sv2-body-sm text-[#4A4640]">
            <li>
              <Link
                href="/about"
                className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors"
              >
                About {appName()}
              </Link>
            </li>
            <li>
              <Link
                href="/request-quote"
                className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors"
              >
                Request a quotation
              </Link>
            </li>
            <li>
              <Link
                href="/business/register"
                className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors"
              >
                Register Business Account
              </Link>
            </li>
            <li>
              <Link
                href="/login?next=/business/dashboard"
                className="hover:text-[#9E4300] hover:underline underline-offset-4 transition-colors"
              >
                Corporate Sign In
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright & Integrity Ledger */}
      <div className="max-w-[1440px] mx-auto pt-4 flex flex-col sm:flex-row items-center justify-between sv2-body-sm text-xs text-[#7C766F] gap-2">
        <p>
          &copy; {currentYear} {appName()}
        </p>
        <div className="flex items-center gap-4 sv2-mono-sm">
          <span>{siteContent.utilityBar.gstNote}</span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">GSTIN: {siteContent.gstin}</span>
        </div>
      </div>
    </footer>
  )
}
