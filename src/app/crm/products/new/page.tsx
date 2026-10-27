import { createClient } from '@/lib/supabase/server'
import { COST_SOURCES, COST_SOURCE_LABEL } from '@/lib/pricing/cost-basis'
import { requireStaff } from '@/lib/auth'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { BrandName } from '@/components/brand/brand-name'
import { createProduct } from '../actions'
import { Package, Globe, Lock, EyeOff, Store, Briefcase, Building2 } from 'lucide-react'
import { ChannelSwitch } from '@/components/products/catalogue-visibility-editor'
import { ProductImageField } from '@/components/products/product-image-field'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { CategoryField } from '@/components/products/category-field'
import { NameCreateField } from '@/components/products/name-create-field'
import { createBrand, createSupplier } from '../actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton href="/crm/products" label="Back to Products" />

      <div className="bg-white p-8 border border-gray-200">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="p-3 bg-[#806A50]/10 text-[#806A50]">
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
          <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <ActionForm action={createProduct} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Product Name *</label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Premium Executive Leather Journal"
                className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">SKU (Product Code) *</label>
              <input
                type="text"
                name="sku"
                required
                placeholder="e.g. GIF-LJ001"
                className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none uppercase"
              />
            </div>

            <CategoryField categories={categories || []} />

            <NameCreateField
              name="brand_id"
              label="Brand"
              options={brands || []}
              emptyLabel="Select Brand (Optional)"
              placeholder="New brand name"
              create={createBrand}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cost price (&#8377;) *</label>
              <input
                type="number"
                name="supplier_cost"
                step="0.01"
                min="0.01"
                required
                placeholder="What you pay the supplier per unit, e.g. 450"
                className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Selling prices are set in{' '}
                <Link href="/crm/pricing" className="font-semibold text-[#806A50] underline underline-offset-2 hover:text-[#624b32]">
                  Pricing
                </Link>
                . Fixed prices and margins per portal live there.
              </p>
              <label className="mt-2 block text-xs font-semibold text-gray-700 mb-1.5">Cost source</label>
              <select
                name="cost_source"
                defaultValue="portal_default"
                className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
              >
                {COST_SOURCES.map((source) => <option key={source} value={source}>{COST_SOURCE_LABEL[source]}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Minimum Order Qty (MOQ) *</label>
              <input
                type="number"
                name="moq"
                defaultValue="50"
                min="1"
                required
                className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Stock on hand</label>
              <input
                type="number"
                name="stock_qty"
                defaultValue="0"
                min="0"
                step="1"
                className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
              />
            </div>

            <MobileSheetSelect
              name="fulfillment_mode"
              label="Purchase path"
              showDesktopLabel
              defaultValue="auto"
              options={[
                { value: 'auto', label: 'Auto — stock decides' },
                { value: 'buy', label: 'Buy — immediate purchase' },
                { value: 'rfq', label: 'Request quote' },
              ]}
            />

            <NameCreateField
              name="supplier_id"
              label="Supplier"
              options={suppliers || []}
              emptyLabel="Select Supplier (Optional)"
              placeholder="New supplier name"
              create={createSupplier}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Lead time (days)</label>
              <input
                type="number"
                name="lead_time_days"
                min="0"
                step="1"
                placeholder="For this supplier"
                className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" name="is_preferred" value="on" />
              Preferred supplier
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" name="sample_only" value="on" />
              Sample only. Stays in Samples. Not shown on the retail store, Business portal, or client portals.
            </label>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Initial pieces in office</label>
              <input
                type="number"
                name="sample_qty"
                min="0"
                step="1"
                placeholder="Blank uses stock on hand when sample only is ticked"
                className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
              />
              <p className="text-[11px] text-gray-500 mt-1">Saved once, the first time this product is added to Samples.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">HSN code</label>
              <input
                type="text"
                name="hsn_code"
                className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
              />
            </div>
          </div>

          <p className="text-[11px] text-gray-500">
            Auto with stock shows Add to cart up to that quantity, and Request quote for a larger run. Auto with zero stock shows Request quote.
            Buy with zero stock shows Add to cart for any quantity. Buy with stock caps Add to cart and still offers Request quote for more.
            Request quote hides Add to cart. A surface with prices hidden, and every catalog kit, stays on Request quote.
          </p>

          <ProductImageField />

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Stored image URL (optional)</label>
            <input
              type="url"
              name="image_url"
              placeholder="Only if the photo is already in product-images storage"
              className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">Prefer uploading a photo above. Do not use localhost or unrelated stock URLs.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description / Customisation Notes</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Dimensions, material composition, custom branding instructions..."
              className="w-full px-3 py-2 text-xs border border-gray-200 focus:ring-1 focus:ring-[#806A50] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Colour</label>
              <input name="colour" className="w-full px-3 py-2 text-xs border border-gray-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Size</label>
              <input name="size" className="w-full px-3 py-2 text-xs border border-gray-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Gender</label>
              <input name="gender" className="w-full px-3 py-2 text-xs border border-gray-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Material</label>
              <input name="material" className="w-full px-3 py-2 text-xs border border-gray-200" />
            </div>
          </div>

          {profile.role === 'admin' && (
          <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-5 space-y-5 rounded-none">
            <input type="hidden" name="channel_present" value="1" />
            <div>
              <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1B1A]">Where this product shows</h3>
              <p className="text-xs text-[#7C766F] mt-0.5">
                Each channel is switched on or off on its own. Corporate visibility never hides a product from the retail store.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ChannelSwitch
                name="show_in_store"
                checked
                icon={<Store className="w-3.5 h-3.5 text-[#9E4300]" />}
                title="Retail store"
                hint="Public store, catalogue, search and homepage."
              />
              <ChannelSwitch
                name="show_in_business"
                checked
                icon={<Briefcase className="w-3.5 h-3.5 text-[#9E4300]" />}
                title="Business portal"
                hint="/business, for registered non-corporate businesses."
              />
            </div>

            <div className="space-y-2">
              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A]">
                  <Building2 className="w-3.5 h-3.5 text-[#9E4300]" /> Corporate visibility
                </h4>
                <p className="text-[11px] text-[#7C766F] mt-0.5">
                  Corporate /portal, client catalogues and microsites only.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { value: 'all', label: 'All companies', hint: 'Every corporate client portal and microsite.', icon: <Globe className="w-3.5 h-3.5 text-[#3A4537]" /> },
                  { value: 'selected', label: 'Selected companies', hint: 'Only the corporate clients ticked below.', icon: <Lock className="w-3.5 h-3.5 text-[#9E4300]" /> },
                  { value: 'none', label: 'None', hint: 'No corporate portal or microsite.', icon: <EyeOff className="w-3.5 h-3.5 text-[#7C766F]" /> },
                ].map((option) => (
                  <label key={option.value} className="flex items-start gap-3 p-3.5 bg-white border border-[#CCC5BD] rounded-none cursor-pointer hover:border-[#9E4300] transition-colors">
                    <input
                      type="radio"
                      name="catalogue_access"
                      value={option.value}
                      defaultChecked={option.value === 'all'}
                      className="mt-1 accent-[#9E4300]"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[#1C1B1A]">
                        {option.icon}
                        {option.label}
                      </div>
                      <p className="text-[11px] text-[#7C766F] mt-1">{option.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4640] mb-2">
                Corporate clients (when Selected companies is chosen):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-white border border-[#CCC5BD]">
                {companies?.map((comp) => (
                  <label key={comp.id} className="flex items-center gap-2 p-1.5 text-xs text-[#4A4640] hover:bg-[#F6F3EC] cursor-pointer">
                    <input
                      type="checkbox"
                      name="company_ids"
                      value={comp.id}
                      className="accent-[#9E4300]"
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
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </Link>
            <SubmitButton
              className="px-6 py-2 text-xs font-semibold text-white bg-[#806A50] hover:bg-[#624b32] transition-colors"
             pendingLabel="Creating…">
              Create Product
            </SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  )
}
