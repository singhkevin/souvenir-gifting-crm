import type { Metadata } from 'next'
import Link from 'next/link'
import { appName } from '@/lib/brand'
import { BrandName } from '@/components/brand/brand-name'
import { SiteShell } from '@/components/site/site-shell'
import { siteContent } from '@/config/siteContent'

export const metadata: Metadata = {
  title: 'About & Contact',
  description: `${appName()} is a corporate and retail gifting service, from gift selections through custom packaging and dispatch.`,
}

export default function AboutPage() {
  return (
    <SiteShell>
      {/* 1. Architectural Hero Banner */}
      <section className="w-full bg-[#1C1B1A] text-[#FCF9F2] border-b border-[#3A3835]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="font-sans text-xs font-semibold text-[#FFB690] uppercase tracking-wider flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-[#9E4300]" />
              <span>About Souvenir</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-[#FCF9F2] leading-tight font-normal">
              Gifting, <span className="italic text-[#FFB690] font-serif font-normal">crafted</span> in India.
            </h1>
            <p className="font-sans text-base sm:text-lg text-[#CCC5BD] max-w-2xl font-light leading-relaxed">
              <BrandName /> is a corporate and retail gifting service. We help organisations and individuals select, customise, and deliver gifts across India.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-6 text-[#A8A199] font-sans text-xs">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#9E4300]" />
                <span>PAN-INDIA DELIVERY</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#9E4300]" />
                <span>VERIFIED CONSIGNMENTS</span>
              </div>
            </div>
          </div>

          {/* Right Metadata Spec Sheet Box */}
          <div className="lg:col-span-5 border border-[#3A3835] bg-[#141312] p-6 space-y-4">
            <div className="border-b border-[#2D2A27] pb-3 flex justify-between items-center">
              <span className="font-sans text-xs font-semibold text-[#FFB690] uppercase tracking-wider">
                Studio Information
              </span>
              <span className="font-sans text-[10px] text-[#A8A199] uppercase tracking-wider">Verified</span>
            </div>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-[#242220]">
                <span className="text-[#A8A199]">COVERAGE:</span>
                <span className="text-[#FCF9F2]">{siteContent.stats.pinCodes}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#242220]">
                <span className="text-[#A8A199]">DISPATCH SLA:</span>
                <span className="text-[#FCF9F2]">{siteContent.stats.dispatch}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#242220]">
                <span className="text-[#A8A199]">TRANSIT COVER:</span>
                <span className="text-[#FFB690]">{siteContent.stats.breakageCover}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#A8A199]">TAX COMPLIANCE:</span>
                <span className="text-[#FCF9F2]">{siteContent.utilityBar.gstNote}</span>
              </div>
            </div>
            <div className="pt-2">
              <div className="w-full bg-[#1C1B1A] border border-[#2D2A27] p-3 text-center font-mono text-[11px] text-[#CCC5BD]">
                GSTIN: {siteContent.gstin}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Section 01: The Craft Standards */}
      <section className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-[#FCF9F2] border-b border-[#CCC5BD]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="border-b border-[#CCC5BD] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#1C1B1A]">Our Process</h2>
              <p className="font-sans text-sm text-[#4A4640] mt-1">Three stages from product selection to delivery.</p>
            </div>
            <div className="font-sans text-xs font-semibold text-[#7C766F] uppercase tracking-wider">
              Standards &amp; Quality
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border border-[#CCC5BD] bg-[#F6F3EC] divide-y md:divide-y-0 md:divide-x divide-[#CCC5BD]">
            <div className="p-8 space-y-6 flex flex-col justify-between bg-[#F6F3EC] hover:bg-[#FCF9F2] transition-colors">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-sans text-xs font-bold text-[#9E4300] uppercase tracking-wider">
                    01 Selection
                  </span>
                </div>
                <h3 className="font-serif text-xl text-[#1C1B1A]">Product Selection</h3>
                <p className="font-sans text-sm text-[#4A4640] leading-relaxed">
                  We test materials, weight, and finish before adding any gift to the catalogue. Samples are verified for quality and presentation.
                </p>
              </div>
              <div className="border-t border-[#CCC5BD] pt-4 font-mono text-xs text-[#7C766F] space-y-1.5">
                <div className="flex justify-between">
                  <span>SAMPLES:</span>
                  <span className="text-[#1C1B1A] font-semibold">AVAILABLE ON REQUEST</span>
                </div>
                <div className="flex justify-between">
                  <span>PACKAGING:</span>
                  <span className="text-[#1C1B1A] font-semibold">{siteContent.retail.packagingNote}</span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6 flex flex-col justify-between bg-[#F6F3EC] hover:bg-[#FCF9F2] transition-colors">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-sans text-xs font-bold text-[#9E4300] uppercase tracking-wider">
                    02 Sourcing
                  </span>
                </div>
                <h3 className="font-serif text-xl text-[#1C1B1A]">Direct Sourcing</h3>
                <p className="font-sans text-sm text-[#4A4640] leading-relaxed">
                  We work directly with workshops and brand partners across India to source quality materials and ensure reliable supply.
                </p>
              </div>
              <div className="border-t border-[#CCC5BD] pt-4 font-mono text-xs text-[#7C766F] space-y-1.5">
                <div className="flex justify-between">
                  <span>PARTNERS:</span>
                  <span className="text-[#1C1B1A] font-semibold">VERIFIED WORKSHOPS</span>
                </div>
                <div className="flex justify-between">
                  <span>SUPPLY:</span>
                  <span className="text-[#1C1B1A] font-semibold">DIRECT PROCUREMENT</span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6 flex flex-col justify-between bg-[#F6F3EC] hover:bg-[#FCF9F2] transition-colors">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-sans text-xs font-bold text-[#9E4300] uppercase tracking-wider">
                    03 Customisation
                  </span>
                </div>
                <h3 className="font-serif text-xl text-[#1C1B1A]">Custom Branding</h3>
                <p className="font-sans text-sm text-[#4A4640] leading-relaxed">
                  Custom branding options including debossing, engraving, screen printing, and personalised gift cards for your recipients.
                </p>
              </div>
              <div className="border-t border-[#CCC5BD] pt-4 font-mono text-xs text-[#7C766F] space-y-1.5">
                <div className="flex justify-between">
                  <span>CUSTOM BRANDING:</span>
                  <span className="text-[#1C1B1A] font-semibold">AVAILABLE ON REQUEST</span>
                </div>
                <div className="flex justify-between">
                  <span>DELIVERY:</span>
                  <span className="text-[#1C1B1A] font-semibold">PAN-INDIA DISPATCH</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Section 02: Physical Studios */}
      <section className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-[#F6F3EC] border-b border-[#CCC5BD]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="border-b border-[#CCC5BD] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#1C1B1A]">Our Studios</h2>
              <p className="font-sans text-sm text-[#4A4640] mt-1">Visit our studios for material samples and gifting consultations.</p>
            </div>
            <div className="font-sans text-xs font-semibold text-[#7C766F] uppercase tracking-wider">
              Locations &amp; Visits
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Studio 1 */}
            <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="font-serif text-xl sm:text-2xl text-[#1C1B1A]">
                  {siteContent.retail.studio1}
                </h3>
                <p className="font-sans text-sm text-[#4A4640]">
                  {siteContent.retail.studio1Address}
                </p>
                <div className="pt-2 border-t border-[#CCC5BD] space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-[#7C766F] w-24">TIMING:</span>
                    <span className="text-[#1C1B1A]">{siteContent.retail.openingHours}</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-[#CCC5BD] flex items-center justify-between">
                <Link
                  href="/request-quote"
                  className="bg-[#000000] hover:bg-[#9E4300] text-[#FCF9F2] px-4 py-2 font-sans text-xs uppercase tracking-wider font-semibold transition-colors"
                >
                  Book Consultation
                </Link>
              </div>
            </div>

            {/* Studio 2 */}
            <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="font-serif text-xl sm:text-2xl text-[#1C1B1A]">
                  {siteContent.retail.studio2}
                </h3>
                <p className="font-sans text-sm text-[#4A4640]">
                  {siteContent.retail.studio2Address}
                </p>
                <div className="pt-2 border-t border-[#CCC5BD] space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-[#7C766F] w-24">TIMING:</span>
                    <span className="text-[#1C1B1A]">{siteContent.retail.openingHours}</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-[#CCC5BD] flex items-center justify-between">
                <Link
                  href="/request-quote"
                  className="bg-[#000000] hover:bg-[#9E4300] text-[#FCF9F2] px-4 py-2 font-sans text-xs uppercase tracking-wider font-semibold transition-colors"
                >
                  Schedule Consultation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Section 03: Direct Consultation & Contact */}
      <section className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-[#FCF9F2]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="border-b border-[#CCC5BD] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#1C1B1A]">Start a Conversation</h2>
              <p className="font-sans text-sm text-[#4A4640] mt-1">Connect with our team for gift selections or corporate programme quotations.</p>
            </div>
            <div className="font-sans text-xs font-semibold text-[#7C766F] uppercase tracking-wider">
              {siteContent.stats.quoteTurnaround}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 border border-[#CCC5BD] bg-[#F6F3EC] p-8 space-y-6">
              <h3 className="font-serif text-2xl text-[#1C1B1A]">Corporate &amp; Bulk Inquiries</h3>
              <p className="font-sans text-sm leading-relaxed text-[#4A4640]">
                Whether you need gifts for an event, festive hampers for your team, or custom branded keepsakes, our team prepares formal quotations tailored to your timeline.
              </p>
              <div className="pt-4 flex flex-wrap gap-4">
                <Link
                  href="/request-quote"
                  className="bg-[#000000] hover:bg-[#9E4300] text-[#FCF9F2] px-6 py-3 font-sans text-xs uppercase tracking-wider transition-colors font-semibold"
                >
                  Request a Quotation &rarr;
                </Link>
                <Link
                  href="/catalogue"
                  className="border border-[#1C1B1A] bg-transparent text-[#1C1B1A] hover:bg-[#1C1B1A] hover:text-[#FCF9F2] px-6 py-3 font-sans text-xs uppercase tracking-wider transition-colors font-semibold"
                >
                  Browse Catalogue
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 border border-[#CCC5BD] bg-[#FCF9F2] p-8 space-y-6">
              <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-[#9E4300]">
                Direct Contact Desk
              </h4>
              <div className="space-y-4 font-mono text-xs text-[#4A4640]">
                <div className="pb-3 border-b border-[#CCC5BD]">
                  <span className="text-[#7C766F] block mb-1">PHONE:</span>
                  <span className="text-sm font-semibold text-[#1C1B1A]">{siteContent.phone}</span>
                </div>
                <div className="pb-3 border-b border-[#CCC5BD]">
                  <span className="text-[#7C766F] block mb-1">WHATSAPP:</span>
                  <span className="text-sm font-semibold text-[#1C1B1A]">{siteContent.whatsapp}</span>
                </div>
                <div className="pb-3 border-b border-[#CCC5BD]">
                  <span className="text-[#7C766F] block mb-1">EMAIL:</span>
                  <span className="text-sm font-semibold text-[#1C1B1A]">{siteContent.email}</span>
                </div>
                <div>
                  <span className="text-[#7C766F] block mb-1">COVERAGE:</span>
                  <span className="text-sm font-semibold text-[#1C1B1A]">{siteContent.stats.pinCodes}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
