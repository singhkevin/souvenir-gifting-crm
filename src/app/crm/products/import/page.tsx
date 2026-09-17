import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { requireStaff } from '@/lib/auth'
import { CatalogueCsvImporter } from '../CatalogueCsvImporter'

export default async function ImportProductsPage() {
  await requireStaff(['admin', 'sales'])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <BackButton href="/crm/products" label="Back to Products" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import catalogue CSV</h1>
        <p className="text-xs text-gray-500 mt-1">
          Manual product creation remains available.{' '}
          <Link href="/crm/products/new" className="text-[#624B32] font-semibold hover:underline">
            Add a product
          </Link>
        </p>
      </div>
      <CatalogueCsvImporter />
    </div>
  )
}
