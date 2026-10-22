import 'server-only'
import { indiaDate, inWindow } from './schedule'
import { collectionProducts } from './rules'
import { loadCollections } from './server'
import type { PublicProduct } from '@/lib/catalogue/products'
import type { CollectionDef } from './types'

/** Collections the retail store shows today: published, on for the store, in their window. */
function liveInStore(collection: CollectionDef, date: string) {
  return collection.status === 'published' && collection.showInStore && inWindow(collection.schedule, date)
}

/** For /collections: live store collections that are listed, in CRM order. */
export async function listedStoreCollections() {
  const date = indiaDate()
  const { collections } = await loadCollections()
  return collections.filter((collection) => collection.listed && liveInStore(collection, date))
}

/** For /collections/<slug>: listed live store collections. Homepage-only groups have no page. */
export async function storeCollectionBySlug(slug: string) {
  const date = indiaDate()
  const { collections } = await loadCollections()
  return collections.find((collection) => collection.slug === slug && collection.listed && liveInStore(collection, date)) || null
}

export function storeCollectionProducts(products: PublicProduct[], collection: CollectionDef) {
  return collectionProducts(products, collection)
}
