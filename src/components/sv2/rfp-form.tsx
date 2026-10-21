'use client'

import { useState } from 'react'
import { submitPublicQuote } from '@/app/request-quote/actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { siteContent } from '@/config/siteContent'

export function SV2RfpForm({ phone }: { phone?: string | null }) {
  const [submitted, setSubmitted] = useState(false)
  const displayPhone = phone || siteContent.phone

  if (submitted) {
    return (
      <div className="border border-[#7C766F] bg-[#1C1B1A] p-6 sm:p-8 text-center space-y-3">
        <span className="sv2-label text-[#FF8843] block font-bold uppercase tracking-wider">
          // REQUEST RECEIVED //
        </span>
        <h4 className="sv2-headline-sm text-[#FCF9F2]">
          Thank you for reaching out.
        </h4>
        <p className="sv2-body-sm text-[#868382] max-w-md mx-auto">
          Thanks — we&apos;ve got your request and will reply with a quotation.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-[#7C766F] bg-[#1C1B1A] p-6 sm:p-8 flex flex-col justify-between">
      <div>
        {/* Header line */}
        <div className="flex flex-wrap justify-between items-center border-b border-[#7C766F] pb-3 mb-6 gap-2">
          <span className="sv2-label text-[#FFB690] uppercase tracking-wider font-bold">
            REQUEST A QUOTATION
          </span>
          <span className="sv2-mono-sm text-[#7C766F]">
            {siteContent.stats.avgResponse.toUpperCase()}
          </span>
        </div>

        <ActionForm
          action={submitPublicQuote}
          className="space-y-4"
          successMessage="Enquiry sent"
          refresh={false}
          onSuccess={() => setSubmitted(true)}
        >
          {/* Honeypot field */}
          <input type="text" name="fax" className="hidden" tabIndex={-1} autoComplete="off" />

          {/* Row 1: Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block sv2-label text-[11px] text-[#FCF9F2] mb-1 uppercase">
                Contact Name *
              </label>
              <input
                type="text"
                name="full_name"
                required
                placeholder="Rohan Mehta"
                className="w-full bg-[#1C1B1A] border border-[#7C766F] px-3 py-2 text-[#FCF9F2] sv2-body-sm placeholder:text-[#7C766F] focus:border-[#FF8843] focus:outline-none"
              />
            </div>
            <div>
              <label className="block sv2-label text-[11px] text-[#FCF9F2] mb-1 uppercase">
                Work Email *
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="rohan@company.com"
                className="w-full bg-[#1C1B1A] border border-[#7C766F] px-3 py-2 text-[#FCF9F2] sv2-body-sm placeholder:text-[#7C766F] focus:border-[#FF8843] focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Company & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block sv2-label text-[11px] text-[#FCF9F2] mb-1 uppercase">
                Company Name *
              </label>
              <input
                type="text"
                name="company_name"
                required
                placeholder="Tata, Infosys, Zepto..."
                className="w-full bg-[#1C1B1A] border border-[#7C766F] px-3 py-2 text-[#FCF9F2] sv2-body-sm placeholder:text-[#7C766F] focus:border-[#FF8843] focus:outline-none"
              />
            </div>
            <div>
              <label className="block sv2-label text-[11px] text-[#FCF9F2] mb-1 uppercase">
                Phone / WhatsApp
              </label>
              <input
                type="tel"
                name="phone"
                placeholder="+91 98765 43210"
                className="w-full bg-[#1C1B1A] border border-[#7C766F] px-3 py-2 text-[#FCF9F2] sv2-body-sm placeholder:text-[#7C766F] focus:border-[#FF8843] focus:outline-none"
              />
            </div>
          </div>

          {/* Row 3: Estimated Quantity */}
          <div>
            <label className="block sv2-label text-[11px] text-[#FCF9F2] mb-1 uppercase">
              Estimated Quantity *
            </label>
            <select
              name="quantity"
              className="w-full bg-[#1C1B1A] border border-[#7C766F] px-3 py-2 text-[#FCF9F2] sv2-body-sm focus:border-[#FF8843] focus:outline-none"
            >
              <option value="25 - 50 Units">25 - 50 Units</option>
              <option value="50 - 200 Units">50 - 200 Units</option>
              <option value="200 - 500 Units">200 - 500 Units</option>
              <option value="500 – 2,000+ units">500 – 2,000+ units</option>
            </select>
          </div>

          {/* Row 4: Gifting Occasion & Notes */}
          <div>
            <label className="block sv2-label text-[11px] text-[#FCF9F2] mb-1 uppercase">
              Gifting Occasion &amp; Requirements *
            </label>
            <textarea
              name="message"
              required
              rows={3}
              placeholder="e.g. 100 new-hire welcome kits with branded thermal tumbler, notebook and canvas sleeve. Needed in Bengaluru by next month."
              className="w-full bg-[#1C1B1A] border border-[#7C766F] px-3 py-2 text-[#FCF9F2] sv2-body-sm placeholder:text-[#7C766F] focus:border-[#FF8843] focus:outline-none"
            />
          </div>

          <SubmitButton
            pendingLabel="Submitting..."
            className="w-full bg-[#9E4300] hover:bg-[#FF8843] text-[#FCF9F2] py-3.5 sv2-label tracking-wider transition-colors duration-150 text-center uppercase"
          >
            Request Quotation
          </SubmitButton>
        </ActionForm>
      </div>

      <div className="border-t border-[#7C766F] pt-3 mt-4 flex flex-wrap items-center justify-between sv2-body-sm text-xs text-[#7C766F] gap-2">
        <span>Direct Phone: <span className="sv2-mono-sm">{displayPhone}</span></span>
        <span className="text-[#FFB690] sv2-label text-[10px]">{siteContent.utilityBar.gstNote}</span>
      </div>
    </div>
  )
}
