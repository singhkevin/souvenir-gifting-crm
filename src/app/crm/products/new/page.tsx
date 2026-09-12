import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/back-button'
import { BrandName } from '@/components/brand/brand-name'
import { createProduct } from '../actions'
import { Package, Globe, Lock, EyeOff } from 'lucide-react'
import { sortProductCategories } from '@/lib/products/categories'
import { ProductImageField } from '@/components/products/product-image-field'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const profile = await requireStaff(['admin', 'sales'])
  const { error } = await searchParams
  const supabase = await createClient()

  const [{ data: categories }, { data: brands }, { data: suppliers }, { data: companies }] = await Promise.all([
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('companies').select('id, name').eq('status', 'active').order('name'),
  ])

  const handleCreate = async (formData: FormData) => {
    'use server'
    const result = await createProduct(formData)
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      redirect(`/crm/products/new?error=${encodeURIComponent(result.error)}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton href="/crm/products" label="Back to Products" />

      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="p-3 bg-[#4A235A]/10 text-[#4A235A] rounded-xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
            <p className="text-xs text-gray-500">
              Add a new gifting item or custom product to the <BrandName /> catalogue.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <form action={handleCreate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Product Name *</label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Premium Executive Leather Journal"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">SKU (Product Code) *</label>
              <input
                type="text"
                name="sku"
                required
                placeholder="e.g. GIF-LJ001"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A] focus:outline-none font-mono uppercase"
              />
            </div>

            <MobileSheetSelect
              name="category_id"
              label="Category *"
              required
              showDesktopLabel
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
              emptyLabel="Select Brand (Optional)"
              options={[
                { value: '', label: 'Select Brand (Optional)' },
                ...(brands || []).map((b) => ({ value: b.id, label: b.name })),
              ]}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Selling Price (? Retail) *</label>
              <input
                type="number"
                name="price"
                step="0.01"
                required
                placeholder="e.g. 750"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Minimum Order Qty (MOQ) *</label>
              <input
                type="number"
                name="moq"
                defaultValue="50"
                min="1"
                required
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Supplier Cost (?)</label>
              <input
                type="number"
                name="supplier_cost"
                step="0.01"
                placeholder="e.g. 450"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Internal margin (?)</label>
              <input
                type="number"
                name="internal_margin"
                step="0.01"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A] focus:outline-none"
              />
            </div>

            <MobileSheetSelect
              name="supplier_id"
              label="Primary Supplier"
              showDesktopLabel
              emptyLabel="Select Supplier (Optional)"
              options={[
                { value: '', label: 'Select Supplier (Optional)' },
                ...(suppliers || []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">HSN code</label>
              <input
                type="text"
                name="hsn_code"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A] focus:outline-none"
              />
            </div>
          </div>

          <ProductImageField />

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Stored image URL (optional)</label>
            <input
              type="url"
              name="image_url"
              placeholder="Only if the photo is already in product-images storage"
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A] focus:outline-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">Prefer uploading a photo above. Do not use localhost or unrelated stock URLs.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description / Customisation Notes</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Dimensions, material composition, custom branding instructions..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#4A235A] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Colour</label>
              <input name="colour" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Size</label>
              <input name="size" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Gender</label>
              <input name="gender" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Material</label>
              <input name="material" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
            </div>
          </div>

          {profile.role === 'admin' && (
          <div className="border border-purple-100 bg-purple-50/30 p-5 rounded-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Catalogue Access & Company Visibility</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Control whether this product is public to all corporate client portals or personalized for specific companies.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-start gap-3 p-3.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-[#4A235A] transition-colors">
                <input
                  type="radio"
                  name="catalogue_access"
                  value="all"
                  defaultChecked
                  className="mt-1 text-[#4A235A] focus:ring-[#4A235A]"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                    <Globe className="w-3.5 h-3.5 text-green-600" />
                    All companies
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Visible in every corporate client portal catalogue.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-[#4A235A] transition-colors">
                <input
                  type="radio"
                  name="catalogue_access"
                  value="selected"
                  className="mt-1 text-[#4A235A] focus:ring-[#4A235A]"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#4A235A]">
                    <Lock className="w-3.5 h-3.5 text-[#4A235A]" />
                    Personalized / Specific
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Only visible to selected client companies chosen below.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-[#4A235A] transition-colors">
                <input
                  type="radio"
                  name="catalogue_access"
                  value="none"
                  className="mt-1 text-[#4A235A] focus:ring-[#4A235A]"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-700">
                    <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                    Internal Only
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Hidden from all client portals. Available only to internal team.
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Grant Access to Companies (if Personalized / Specific selected):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-lg border border-gray-200">
                {companies?.map((comp) => (
                  <label key={comp.id} className="flex items-center gap-2 p-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      name="company_ids"
                      value={comp.id}
                      className="rounded border-gray-300 text-[#4A235A] focus:ring-[#4A235A]"
                    />
                    <span className="truncate font-medium">{comp.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Link
              href="/crm/products"
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-6 py-2 text-xs font-semibold text-white bg-[#4A235A] hover:bg-[#3d1c4a] rounded-lg transition-colors shadow-sm"
            >
              Create Product
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
