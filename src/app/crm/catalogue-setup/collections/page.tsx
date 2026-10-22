import Link from 'next/link'
import { getPublicCatalogueProducts } from '@/lib/catalogue/products'
import { loadAdminCollections } from '@/lib/homepage/admin-data'
import { collectionProducts } from '@/lib/homepage/rules'
import { indiaDate, inWindow } from '@/lib/homepage/schedule'
import { Badge, buttonClass, scheduleLabel, SetupNotice } from '../ui'

export default async function CollectionsSetupPage() {
  const [{ ready, reason, collections }, products] = await Promise.all([loadAdminCollections(), getPublicCatalogueProducts('store')])
  const today = indiaDate()
  return (
    <div className="space-y-5">
      {reason ? <SetupNotice>{reason}</SetupNotice> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-500">
          A collection is a rule over product fields (category, occasion tag, price, name or description words) or a hand-picked list.
          Saved changes are live straight away for published collections. Counts are retail store products.
        </p>
        {ready ? (
          <Link href="/crm/catalogue-setup/collections/new" className={buttonClass}>
            New collection
          </Link>
        ) : null}
      </div>
      <div className="overflow-x-auto border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Collection</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Where</th>
              <th className="px-4 py-3 font-semibold">Window</th>
              <th className="px-4 py-3 text-right font-semibold">Products</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {collections.map((collection) => {
              const count = collectionProducts(products, collection).length
              const href = collection.id ? `/crm/catalogue-setup/collections/${collection.id}` : null
              return (
                <tr key={collection.slug}>
                  <td className="px-4 py-3">
                    {href ? (
                      <Link href={href} className="font-semibold text-gray-900 hover:text-[#9E4300] hover:underline">
                        {collection.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-900">{collection.title}</span>
                    )}
                    <span className="block font-mono text-[11px] text-gray-400">{collection.slug}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{collection.source === 'manual' ? 'Hand-picked' : 'Rule'}</td>
                  <td className="px-4 py-3">
                    {collection.status === 'published' ? <Badge tone="live">Published</Badge> : <Badge tone="draft">Draft</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {collection.showInStore ? <Badge>Store</Badge> : null}
                      {collection.showInBusiness ? <Badge>Business</Badge> : null}
                      {collection.listed ? <Badge>Listed</Badge> : <Badge>Homepage only</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {scheduleLabel(collection.schedule)}
                    {!inWindow(collection.schedule, today) ? <span className="ml-1"><Badge tone="warn">Off today</Badge></span> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{count}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
