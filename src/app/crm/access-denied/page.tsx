import Link from 'next/link'
import { ShieldOff } from 'lucide-react'

export default function AccessDeniedPage() {
  return (
    <div>
      <div className="max-w-lg bg-white border border-[#E5DFD5] rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-8 h-8 shrink-0 rounded-md bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center">
            <ShieldOff size={16} />
          </span>
          <div>
            <h1 className="text-base font-semibold text-[#1C1917]">Access denied</h1>
            <p className="text-sm text-[#6B6358] mt-1">
              Your role does not include this section. Pick another page from the sidebar, or return to the dashboard.
            </p>
            <Link
              href="/crm/dashboard"
              className="inline-flex mt-4 px-3 py-1.5 rounded-md text-sm font-medium bg-[#1A3022] text-[#FAF7F2] hover:bg-[#274433] hover:text-[#FAF7F2]"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
