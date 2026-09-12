import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { requireStaff } from '@/lib/auth'
import { Upload, PencilLine } from 'lucide-react'

export default async function AddProductChoicePage() {
  await requireStaff(['admin', 'sales'])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackButton href="/crm/products" label="Back to Products" />

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Add Product</h1>
        <p className="mt-1 text-xs text-gray-500">Choose how you&apos;d like to add products to the catalogue.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/crm/products/import"
            className="group flex flex-col items-start gap-3 rounded-xl border border-gray-200 p-5 text-left transition-colors hover:border-[#4A235A] hover:bg-[#4A235A]/5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4A235A]/10 text-[#4A235A]">
              <Upload size={18} />
            </span>
            <span className="font-semibold text-gray-900">Import CSV</span>
            <span className="text-xs leading-relaxed text-gray-500">
              Bulk-upload products from a spreadsheet. Best when adding many items at once.
            </span>
          </Link>

          <Link
            href="/crm/products/new"
            className="group flex flex-col items-start gap-3 rounded-xl border border-gray-200 p-5 text-left transition-colors hover:border-[#4A235A] hover:bg-[#4A235A]/5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4A235A]/10 text-[#4A235A]">
              <PencilLine size={18} />
            </span>
            <span className="font-semibold text-gray-900">Add Manually</span>
            <span className="text-xs leading-relaxed text-gray-500">
              Fill in a single product&apos;s name, pricing, category and images yourself.
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
