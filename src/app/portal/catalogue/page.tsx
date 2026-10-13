import { redirect } from 'next/navigation'
import { isUuid } from '@/lib/utils'

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function CatalogueRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const collectionId = first(sp.catalog) || first(sp.campaign)
  if (collectionId && isUuid(collectionId)) redirect(`/portal/gifts/collection/${collectionId}`)

  const params = new URLSearchParams()
  const q = first(sp.q)
  const category = first(sp.category)
  const sort = first(sp.sort)
  const page = first(sp.page)
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  if (sort) params.set('sort', sort)
  if (page) params.set('page', page)
  const qs = params.toString()
  redirect(qs ? `/portal/gifts?${qs}` : '/portal/gifts')
}
