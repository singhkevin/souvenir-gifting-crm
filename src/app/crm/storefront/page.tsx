import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { STORE_OCCASIONS } from '@/lib/catalogue/storefront'
import { saveBrandLogo, saveProductOccasions } from './actions'

export default async function StorefrontAdminPage() {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const [{ data: brands, error: brandError }, { data: products }] = await Promise.all([
    supabase.from('brands').select('id, name, logo_url').order('name'),
    supabase.from('products').select('id, name, sku').eq('status', 'active').order('name').limit(200),
  ])
  const brandRows = brandError ? [] : brands || []

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Storefront</h1>
        <p className="mt-1 text-sm text-gray-500">Brand logos and occasion tags for the public shop. Product details stay on the product page.</p>
      </div>
      {brandError ? (
        <p className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Apply the storefront migration before saving logos.
        </p>
      ) : null}
      <ActionForm action={saveBrandLogo} className="space-y-3 border bg-white p-4">
        <h2 className="text-sm font-semibold">Brand logo</h2>
        <label className="block text-xs text-gray-500">
          Brand
          <select name="brand_id" className="mt-1 w-full border px-3 py-2 text-sm" required>
            <option value="">Choose</option>
            {brandRows.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-500">
          Logo URL or site path
          <input name="logo_url" placeholder="/logo.png or https://…" className="mt-1 w-full border px-3 py-2 text-sm" />
        </label>
        <SubmitButton className="bg-[#241C12] px-4 py-2 text-sm font-semibold text-white" pendingLabel="Saving…">
          Save logo
        </SubmitButton>
      </ActionForm>
      <ActionForm action={saveProductOccasions} className="space-y-3 border bg-white p-4">
        <h2 className="text-sm font-semibold">Occasion tags</h2>
        <label className="block text-xs text-gray-500">
          Product
          <select name="product_id" className="mt-1 w-full border px-3 py-2 text-sm" required>
            <option value="">Choose</option>
            {(products || []).map((product) => (
              <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          {STORE_OCCASIONS.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`tag_${item.id}`} />
              {item.label}
            </label>
          ))}
        </div>
        <SubmitButton className="bg-[#241C12] px-4 py-2 text-sm font-semibold text-white" pendingLabel="Saving…">
          Save occasions
        </SubmitButton>
      </ActionForm>
    </div>
  )
}
