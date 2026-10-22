import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { ActionForm } from '@/components/ui/action-form'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { getPublicCatalogueProducts, type PublicProduct } from '@/lib/catalogue/products'
import { createClient } from '@/lib/supabase/server'
import { loadAdminCollections, loadCatalogueFacets } from '@/lib/homepage/admin-data'
import { ruleToForm } from '@/lib/homepage/form'
import { collectionProducts } from '@/lib/homepage/rules'
import type { CollectionDef } from '@/lib/homepage/types'
import { formatCurrency, isUuid } from '@/lib/utils'
import { addCollectionProduct, deleteCollection, moveCollectionProduct, removeCollectionProduct, saveCollection } from '../../actions'
import { buttonClass, Field, ghostButtonClass, inputClass, ScheduleFields, SetupNotice } from '../../ui'
import { ProductThumb } from '@/components/ui/product-thumb'

const BLANK: CollectionDef = {
  slug: '',
  title: '',
  kicker: 'Collection',
  description: '',
  imageUrl: null,
  source: 'rule',
  rule: {},
  sort: 'catalogue',
  status: 'draft',
  showInStore: true,
  showInBusiness: true,
  listed: true,
  schedule: {},
  position: 200,
  productIds: [],
}

function ProductRow({ product, children }: { product: Pick<PublicProduct, 'id' | 'name' | 'sku' | 'image_url' | 'price'>; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 p-3">
      <ProductThumb src={product.image_url} alt={product.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
        <p className="font-mono text-[11px] text-gray-500">
          {product.sku}
          {product.price ? ` · ${formatCurrency(product.price)}` : ''}
        </p>
      </div>
      {children}
    </li>
  )
}

export default async function CollectionSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { id } = await params
  const { q = '' } = await searchParams
  const isNew = id === 'new'
  if (!isNew && !isUuid(id)) notFound()
  const [{ ready, reason, collections }, facets, products] = await Promise.all([
    loadAdminCollections(),
    loadCatalogueFacets(),
    getPublicCatalogueProducts('store'),
  ])
  const collection = isNew ? BLANK : collections.find((item) => item.id === id)
  if (!collection) notFound()
  const rule = ruleToForm(collection.rule)
  const matches = isNew ? [] : collectionProducts(products, collection)
  const byId = new Map(products.map((product) => [product.id, product]))

  // Hand-picked products may be hidden from the store; still list them so they can be removed.
  const supabase = await createClient()
  const missing = collection.productIds.filter((productId) => !byId.has(productId))
  const extra = missing.length
    ? (((await supabase.from('products').select('id, name, sku, image_url').in('id', missing)).data || []).map((row) => ({ ...row, price: null })) as PublicProduct[])
    : []
  for (const product of extra) byId.set(product.id, product)

  const search = q.replace(/[,()*%]/g, ' ').trim()
  const results = search
    ? products
        .filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase()))
        .filter((product) => !collection.productIds.includes(product.id))
        .slice(0, 20)
    : []
  const categories = [...new Set([...facets.categories, ...rule.categories])]

  return (
    <div className="space-y-6">
      <div>
        <Link href="/crm/catalogue-setup/collections" className="text-xs font-semibold uppercase tracking-wider text-[#9E4300] hover:underline">
          ← All collections
        </Link>
        <h2 className="mt-2 font-serif text-2xl text-gray-900">{isNew ? 'New collection' : collection.title}</h2>
      </div>
      {!ready ? <SetupNotice>{reason}</SetupNotice> : null}
      {rule.mixed ? (
        <SetupNotice>This rule combines “all” and “any” conditions, which this form cannot show exactly. Saving rewrites it with one mode.</SetupNotice>
      ) : null}

      <ActionForm action={saveCollection} successMessage="Collection saved" className="space-y-6 border border-gray-200 bg-white p-4 sm:p-6">
        {collection.id ? <input type="hidden" name="id" value={collection.id} /> : null}
        <fieldset disabled={!ready} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input name="title" required defaultValue={collection.title} className={inputClass} />
            </Field>
            <Field label="Slug" hint="Used in the link: /collections/<slug>. Changing it breaks old links and homepage cards that point at it.">
              <input name="slug" required defaultValue={collection.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Kicker">
              <input name="kicker" defaultValue={collection.kicker} className={inputClass} />
            </Field>
            <Field label="Order on /collections" hint="Lower comes first.">
              <input name="position" type="number" defaultValue={collection.position} className={inputClass} />
            </Field>
            <Field label="Description" wide>
              <textarea name="description" rows={2} defaultValue={collection.description} className={inputClass} />
            </Field>
            <Field label="Image URL (optional)" wide>
              <input name="image_url" defaultValue={collection.imageUrl || ''} className={inputClass} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Status">
              <select name="status" defaultValue={collection.status} className={inputClass}>
                <option value="draft">Draft (hidden everywhere)</option>
                <option value="published">Published</option>
              </select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="show_in_store" defaultChecked={collection.showInStore} /> Retail store
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="show_in_business" defaultChecked={collection.showInBusiness} /> Business portal
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-3">
              <input type="checkbox" name="listed" defaultChecked={collection.listed} /> Listed: has its own page and appears on /collections (untick for homepage-only groups)
            </label>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Live between (optional)</h3>
            <ScheduleFields schedule={collection.schedule} />
          </div>

          <div className="space-y-4 border-t border-gray-200 pt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Products">
                <select name="source" defaultValue={collection.source} className={inputClass}>
                  <option value="rule">By rule (pinned products first)</option>
                  <option value="manual">Hand-picked only</option>
                </select>
              </Field>
              <Field label="Rule matches when">
                <select name="rule_mode" defaultValue={rule.mode} className={inputClass}>
                  <option value="any">Any condition below is true</option>
                  <option value="all">Every condition below is true</option>
                </select>
              </Field>
              <Field label="Sort">
                <select name="sort" defaultValue={collection.sort} className={inputClass}>
                  <option value="catalogue">Catalogue order</option>
                  <option value="price_asc">Price, low to high</option>
                  <option value="price_desc">Price, high to low</option>
                  <option value="newest">Newest first</option>
                </select>
              </Field>
            </div>
            <fieldset>
              <legend className="text-xs font-semibold text-gray-600">Category is one of</legend>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                {categories.map((category) => (
                  <label key={category} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="rule_category" value={category} defaultChecked={rule.categories.includes(category)} /> {category}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold text-gray-600">Occasion tag is one of</legend>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                {facets.occasions.map((occasion) => (
                  <label key={occasion.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="rule_occasion" value={occasion.id} defaultChecked={rule.occasions.includes(occasion.id)} /> {occasion.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <p className="text-xs font-semibold text-gray-600">Store price (₹, products without a price count as 0)</p>
              <div className="mt-1 grid gap-3 sm:grid-cols-4">
                <Field label="More than">
                  <input name="price_gt" type="number" step="0.01" defaultValue={rule.priceGt} className={`${inputClass} font-mono`} />
                </Field>
                <Field label="At least">
                  <input name="price_gte" type="number" step="0.01" defaultValue={rule.priceGte} className={`${inputClass} font-mono`} />
                </Field>
                <Field label="Less than">
                  <input name="price_lt" type="number" step="0.01" defaultValue={rule.priceLt} className={`${inputClass} font-mono`} />
                </Field>
                <Field label="At most">
                  <input name="price_lte" type="number" step="0.01" defaultValue={rule.priceLte} className={`${inputClass} font-mono`} />
                </Field>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name contains any of" hint="Comma separated, not case-sensitive.">
                <input name="rule_name_keywords" defaultValue={rule.nameKeywords} className={inputClass} />
              </Field>
              <Field label="Description contains any of">
                <input name="rule_description_keywords" defaultValue={rule.descriptionKeywords} className={inputClass} />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
            <SubmitButton className={buttonClass}>{isNew ? 'Create collection' : 'Save collection'}</SubmitButton>
            {!isNew ? (
              <span className="text-xs text-gray-500">
                <span className="font-mono">{matches.length}</span> retail store products right now.
              </span>
            ) : null}
          </div>
        </fieldset>
      </ActionForm>

      {!isNew && ready && collection.id ? (
        <>
          <section className="border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{collection.source === 'manual' ? 'Hand-picked products' : 'Pinned products'}</h3>
              <p className="text-xs text-gray-500">
                {collection.source === 'manual' ? 'Shown in this order.' : 'Shown first, in this order, before the rule matches.'}
              </p>
            </div>
            {collection.productIds.length ? (
              <ol className="divide-y divide-gray-200">
                {collection.productIds.map((productId, index) => {
                  const product = byId.get(productId)
                  if (!product) return null
                  const hidden = !products.some((item) => item.id === productId)
                  return (
                    <ProductRow key={productId} product={product}>
                      {hidden ? <span className="text-[11px] text-red-700">Not in the store</span> : null}
                      {(['up', 'down'] as const).map((direction) => (
                        <ActionForm key={direction} action={moveCollectionProduct} className="inline" successMessage="Moved">
                          <input type="hidden" name="collection_id" value={collection.id} />
                          <input type="hidden" name="product_id" value={productId} />
                          <input type="hidden" name="direction" value={direction} />
                          <SubmitButton
                            className={ghostButtonClass}
                            pendingLabel="…"
                            aria-label={direction === 'up' ? 'Move up' : 'Move down'}
                            disabled={direction === 'up' ? index === 0 : index === collection.productIds.length - 1}
                          >
                            {direction === 'up' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
                          </SubmitButton>
                        </ActionForm>
                      ))}
                      <ActionForm action={removeCollectionProduct} className="inline" successMessage="Removed">
                        <input type="hidden" name="collection_id" value={collection.id} />
                        <input type="hidden" name="product_id" value={productId} />
                        <SubmitButton className={ghostButtonClass} pendingLabel="…">
                          Remove
                        </SubmitButton>
                      </ActionForm>
                    </ProductRow>
                  )
                })}
              </ol>
            ) : (
              <p className="p-4 text-sm text-gray-500">None yet.</p>
            )}
            <form method="get" className="flex gap-2 border-t border-gray-200 p-4">
              <input name="q" defaultValue={q} placeholder="Search store products by name or SKU" className={inputClass} />
              <button type="submit" className={ghostButtonClass}>
                Search
              </button>
            </form>
            {results.length ? (
              <ul className="divide-y divide-gray-200 border-t border-gray-200">
                {results.map((product) => (
                  <ProductRow key={product.id} product={product}>
                    <ActionForm action={addCollectionProduct} className="inline" successMessage="Added">
                      <input type="hidden" name="collection_id" value={collection.id} />
                      <input type="hidden" name="product_id" value={product.id} />
                      <SubmitButton className={ghostButtonClass} pendingLabel="…">
                        Add
                      </SubmitButton>
                    </ActionForm>
                  </ProductRow>
                ))}
              </ul>
            ) : search ? (
              <p className="border-t border-gray-200 p-4 text-sm text-gray-500">No store products match “{search}”.</p>
            ) : null}
          </section>

          <section className="border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">What the store shows</h3>
              <p className="text-xs text-gray-500">First 12 of {matches.length}, as saved.</p>
            </div>
            <ul className="divide-y divide-gray-200">
              {matches.slice(0, 12).map((product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </ul>
          </section>

          <ConfirmAction
            title={`Delete ${collection.title}?`}
            description="Its page and hand-picked list are removed. Blocked while the homepage uses it; set it to Draft to hide it instead."
            confirmLabel="Delete"
            action={deleteCollection}
            hiddenFields={{ id: collection.id }}
            successMessage="Collection deleted"
          >
            Delete collection
          </ConfirmAction>
        </>
      ) : null}
    </div>
  )
}
