import { siteContent } from '@/config/siteContent'

/**
 * SV2 Utility Bar — charcoal announcement bar at top of page.
 * Displays dispatch verification, shipping/GST compliance notes,
 * concierge contact, and B2B minimum order note.
 */
export function UtilityBar({ phone }: { phone?: string | null }) {
  const displayPhone = phone || siteContent.phone

  return (
    <aside
      className="w-full max-w-full overflow-hidden bg-[#1C1B1A] text-[#FCF9F2] px-4 sm:px-8 lg:px-16 py-2 border-b border-[#7C766F] flex flex-wrap justify-between items-center sv2-body-sm text-xs gap-2"
      aria-label="Service notes and contact"
    >
      <div className="flex items-center flex-wrap gap-2 sm:gap-4">
        <span className="flex items-center gap-1.5 text-[#FF8843] font-medium sv2-mono-sm">
          <span className="sv2-pulse-dot" aria-hidden="true" />
          {siteContent.utilityBar.dispatchStatus}
        </span>
        <span className="text-[#868382] hidden sm:inline">|</span>
        <span className="text-[#cac6c4] sv2-mono-sm">{siteContent.utilityBar.shippingNote}</span>
        <span className="text-[#868382] hidden md:inline">|</span>
        <span className="text-[#cac6c4] hidden md:inline sv2-mono-sm">{siteContent.utilityBar.gstNote}</span>
      </div>

      <div className="flex items-center flex-wrap gap-2 sm:gap-4">
        <span className="text-[#FCF9F2]">
          Phone: <span className="sv2-mono-sm">{displayPhone}</span>
        </span>
        <span className="text-[#868382] hidden sm:inline">|</span>
        <span className="text-[#FF8843] font-medium hidden sm:inline sv2-mono-sm">
          {siteContent.stats.minimumOrder}
        </span>
      </div>
    </aside>
  )
}
