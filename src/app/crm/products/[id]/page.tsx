import { createClient } from '@/lib/supabase/server'
import { formatCurrency, isUuid } from '@/lib/utils'
import { notFound, redirect } from 'next/navigation'
import { sortProductCategories } from '@/lib/products/categories'
import { BackButton } from '@/components/ui/back-button'
import { updateProduct, removeProduct } from '../actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { asFormAction } from '@/lib/form-action'
import { Globe, Lock, EyeOff } from 'lucide-react'
import { ProductImageEditor } from '@/components/products/product-image-editor'
import { CatalogueVisibilityEditor } from '@/components/products/catalogue-visibility-editor'
import { requireStaff, canSeeCosts } from '@/lib/auth'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ removed?: string; image?: string; error?: string }>
}) {
  const profile = await requireStaff(['admin', 'sales', 'management', 'operations'])
  const showCost = canSeeCosts(profile.role)
  const { id } = await params
  const { removed, image, error } = await searchParams
  if (!isUuid(id)) notFound()
  const supabase = await createClient()

  const [
    { data: product },
    { data: categories },
    { data: brands },
    { data: suppliers },
    { data: allCompanies },
    { data: accessRecords },
  ] = await Promise.all([
    supabase.from('products').select('*, category:categories(id, name), brand:brands(id, name), supplier:suppliers(id, name)').eq('id', id).maybeSingle(),
    supabase.from('categories').select('id, name'),
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('companies').select('id, name, logo_path').eq('status', 'active').order('name'),
    supabase.from('company_product_access').select('*, company:companies(id, name, city)').eq('product_id', id),
  ])

  if (!product) notFound()

  const grantedCompanyIds = accessRecords?.map(a => a.company_id) || []

  const handleUpdate = async (formData: FormData) => {
    'use server'
    const result = await updateProduct(product.id, formData)
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      redirect(`/crm/products/${product.id}?error=${encodeURIComponent(result.error)}`)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <BackButton href="/crm/products" label="Back to Products" />

      {removed === 'archived' && (
        <div className="p-3 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200">
          This product cannot be permanently deleted because it is used on orders or quotations. It was discontinued instead.
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200">{error}</div>
      )}
      {image === 'needed' && !product.image_url && (
        <div className="p-3 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200">
          This product was saved without a photo. Upload one below so it displays correctly in the catalogue.
        </div>
      )}
      {image === 'upload-failed' && (
        <div className="p-3 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200">
          The product was saved, but the image could not be uploaded. Try again with a JPG, PNG or WebP under 5 MB.
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
        <ProductImageEditor productId={product.id} imageUrl={product.image_url} name={product.name} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {product.sku}
            </span>
            {product.catalogue_access === 'all' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full">
                <Globe className="w-3 h-3" /> All companies
              </span>
            )}
            {product.catalogue_access === 'selected' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-100 text-[#4A235A] px-2.5 py-0.5 rounded-full">
                <Lock className="w-3 h-3" /> {accessRecords?.length || 0} companies
              </span>
            )}
            {product.catalogue_access === 'none' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">
                <EyeOff className="w-3 h-3" /> Not in catalogues
              </span>
            )}
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${
              product.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {product.status}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{product.name}</h1>
          <p className="text-xs text-gray-500 mt-1">
            Category: <span className="font-semibold text-gray-700">{(product.category as any)?.name || 'General'}</span>
            {product.brand && <> ? Brand: <span className="font-semibold text-gray-700">{(product.brand as any)?.name}</span></>}
            {product.supplier && <> ? Supplier: <span className="font-semibold text-gray-700">{(product.supplier as any)?.name}</span></>}
          </p>
          {profile.role === 'admin' && (
            <div className="mt-3">
              <ConfirmAction
                title="Delete product?"
                confirmLabel="Delete"
                action={asFormAction(removeProduct)}
                hiddenFields={{ product_id: product.id }}
                description={
                  <>
                    <p>
                      Product: <span className="font-semibold text-gray-900">{product.name}</span>
                    </p>
                    <p>
                      If this product appears on orders, quotations, or sample history it will be discontinued instead of permanently deleted. Images shared with other products are kept.
                    </p>
                  </>
                }
              >
                Delete Product
              </ConfirmAction>
            </div>
          )}

          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Retail Price</p>
              <p className="text-xl font-bold text-[#4A235A]">{formatCurrency(product.price)}</p>
            </div>
            {showCost && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Supplier Cost</p>
              <p className="text-lg font-semibold text-gray-700">{formatCurrency(product.supplier_cost)}</p>
            </div>
            )}
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Min Order Qty</p>
              <p className="text-lg font-semibold text-gray-900">{product.moq || 1} units</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-100">
            Edit Product Information
          </h2>

          <form action={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Product Name</label>
              <input
                type="text"
                name="name"
                defaultValue={product.name}
                required
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  name="sku"
                  defaultValue={product.sku}
                  required
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg font-mono uppercase focus:ring-1 focus:ring-[#4A235A]"
                />
                <p className="text-[10px] text-gray-400 mt-1">Permanent identifier. Admin-only to change; changes are audited.</p>
              </div>

              <MobileSheetSelect
                name="status"
                label="Status"
                showDesktopLabel
                defaultValue={product.status}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'discontinued', label: 'Discontinued' },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Retail (?)</label>
                <input
                  type="number"
                  step="0.01"
                  name="price"
                  defaultValue={product.price}
                  required
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg"
                />
              </div>
              {showCost && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cost (?)</label>
                <input
                  type="number"
                  step="0.01"
                  name="supplier_cost"
                  defaultValue={product.supplier_cost || ''}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg"
                />
              </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">MOQ</label>
                <input
                  type="number"
                  name="moq"
                  defaultValue={product.moq || 1}
                  required
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MobileSheetSelect
                name="category_id"
                label="Category *"
                required
                showDesktopLabel
                defaultValue={product.category_id || ''}
                emptyLabel="Select Category"
                options={[
                  { value: '', label: 'Select Category' },
                  ...sortProductCategories(categories || []).map((c) => ({ value: c.id, label: c.name })),
                ]}
              />

              <MobileSheetSelect
                name="brand_id"
                label="Brand"
                showDesktopLabel
                defaultValue={product.brand_id || ''}
                emptyLabel="Select Brand"
                options={[
                  { value: '', label: 'Select Brand' },
                  ...(brands || []).map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            </div>

            <MobileSheetSelect
              name="supplier_id"
              label="Supplier"
              showDesktopLabel
              defaultValue={product.supplier_id || ''}
              emptyLabel="No supplier"
              options={[
                { value: '', label: 'No supplier' },
                ...(suppliers || []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                rows={3}
                defaultValue={product.description || ''}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 text-xs font-semibold text-white bg-[#4A235A] hover:bg-[#3d1c4a] hover:text-white rounded-lg shadow-sm transition-colors"
            >
              Save Product Details
            </button>
          </form>
        </div>

        {profile.role === 'admin' ? (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <CatalogueVisibilityEditor
            productId={product.id}
            initialMode={product.catalogue_access || 'all'}
            companies={allCompanies || []}
            grantedIds={grantedCompanyIds}
          />
        </div>
        ) : (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-2">Catalogue visibility</h2>
          <p className="text-xs text-gray-500">Only admin can change which companies see this product.</p>
        </div>
        )}
      </div>
    </div>
  )
}
