import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { CompanyAvatar } from '@/components/ui/avatar'
import { ProductImage } from '@/components/ui/product-image'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { uploadCompanyLogo, removeCompanyLogo, updateCompany, removeCompany } from '../actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { formatCurrency, formatDate, isUuid } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'
import { grantCompanyProductAccess, revokeCompanyProductAccess } from '@/app/crm/products/actions'
import { requireStaff } from '@/lib/auth'
import { createContact } from '@/app/crm/contacts/actions'
import { asFormAction } from '@/lib/form-action'
import { PortalClientForm } from '../portal-client-form'
import { ManageClientLogin } from '../manage-client-login'
import { CLIENT_STATUS_LABELS, ORDER_LIFECYCLE, lifecycleIndex } from '@/lib/order-workflow'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

export default async function CompanyDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; removed?: string }>
}) {
  const profile = await requireStaff()
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { tab = 'overview', removed } = await searchParams
  const canManageVisibility = profile.role === 'admin'
  const canEdit = profile.role === 'admin' || profile.role === 'sales'

  const supabase = await createClient()

  const [
    { data: company },
    { data: contacts },
    { data: leads },
    { data: requirements },
    { data: quotations },
    { data: orders },
    { data: invoices },
    { data: companyProducts },
    { data: allProducts },
    { data: clients },
    { data: companyTasks },
    { count: globalProductCount },
  ] = await Promise.all([
    supabase.from('companies').select('*, owner:profiles!companies_owner_id_fkey(id, full_name, email)').eq('id', id).maybeSingle(),
    supabase.from('contacts').select('*').eq('company_id', id).order('full_name'),
    supabase.from('leads').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('requirements').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('quotations').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('orders').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, invoice_number, amount, status, created_at').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('company_product_access').select('*, product:products!inner(*)').eq('company_id', id).eq('product.status', 'active'),
    supabase.from('products').select('id, name, sku, price').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, email, role, is_active').eq('company_id', id).in('role', ['client_admin', 'client_user']).order('full_name'),
    supabase.from('tasks').select('id, title, status, due_at, assigned_to, order_id, priority, assignee:profiles!assigned_to(full_name)').eq('company_id', id).order('due_at', { ascending: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('catalogue_access', 'all'),
  ])

  if (!company) notFound()

  const assignedProductIds = companyProducts?.map(cp => cp.product_id) || []
  const unassignedProducts = allProducts?.filter(p => !assignedProductIds.includes(p.id)) || []

  const addProductAction = async (formData: FormData) => {
    'use server'
    const productId = formData.get('product_id') as string
    await grantCompanyProductAccess(productId, id)
  }

  const removeProductAction = async (formData: FormData) => {
    'use server'
    const productId = formData.get('product_id') as string
    await revokeCompanyProductAccess(productId, id)
  }

  const uploadLogoAction = async (formData: FormData) => {
    'use server'
    await uploadCompanyLogo(formData)
  }

  const removeLogoAction = async (formData: FormData) => {
    'use server'
    await removeCompanyLogo(formData)
  }

  const saveCompanyAction = async (formData: FormData) => {
    'use server'
    await updateCompany(id, formData)
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'clients', label: `Clients (${clients?.length || 0})` },
    { id: 'catalogue', label: `Catalogue (${companyProducts?.length || 0})` },
    { id: 'contacts', label: `Contacts (${contacts?.length || 0})` },
    { id: 'leads', label: `Leads (${leads?.length || 0})` },
    { id: 'requirements', label: `Requirements (${requirements?.length || 0})` },
    { id: 'quotations', label: `Quotations (${quotations?.length || 0})` },
    { id: 'orders', label: `Orders (${orders?.length || 0})` },
    { id: 'tracking', label: 'Tracking' },
    { id: 'invoices', label: `Invoices (${invoices?.length || 0})` },
  ]

  return (
    <div className="space-y-6">
      <BackButton href="/crm/companies" label="Back to Companies" />

      <Breadcrumbs
        items={[
          { label: 'Companies', href: '/crm/companies' },
          { label: company.name },
        ]}
      />

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 w-full items-center gap-4 sm:w-auto">
          <CompanyAvatar name={company.name} logoPath={company.logo_path} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{company.name}</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mt-1">
              <span>{company.industry || 'Corporate Client'}</span>
              <span aria-hidden="true">·</span>
              <span>{company.city || 'India'}</span>
              {company.website && (
                <>
                  <span aria-hidden="true">·</span>
                  <a href={company.website} target="_blank" rel="noreferrer" className="inline-block truncate max-w-[200px] align-bottom text-[var(--color-primary)] hover:underline font-medium">
                    {company.website}
                  </a>
                </>
              )}
            </div>

            <div className="flex flex-col items-start gap-2 mt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <form action={uploadLogoAction} className="flex w-full items-center gap-2 sm:w-auto">
                <input type="hidden" name="company_id" value={company.id} />
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  className="min-w-0 flex-1 text-[11px] file:mr-2 file:px-2 file:py-1 file:rounded-md file:border file:border-gray-200 file:bg-white file:text-[11px] file:font-medium sm:flex-none"
                />
                <button className="shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-md border border-gray-200 hover:bg-gray-50">
                  {company.logo_path ? 'Change logo' : 'Upload logo'}
                </button>
              </form>
              {company.logo_path && (
                <form action={removeLogoAction}>
                  <input type="hidden" name="company_id" value={company.id} />
                  <button className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-gray-200 text-red-600 hover:bg-red-50">
                    Remove
                  </button>
                </form>
              )}
              <span className="text-[10px] text-gray-400">PNG, JPG or WebP · max 2 MB</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-row items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
            company.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
          }`}>
            {company.status}
          </span>
          {profile.role === 'admin' && (
            <ConfirmAction
              title="Remove company?"
              confirmLabel="Delete"
              action={asFormAction(removeCompany)}
              hiddenFields={{ company_id: company.id }}
              description={
                <>
                  <p>
                    Company: <span className="font-semibold text-gray-900">{company.name}</span>
                  </p>
                  <p>
                    Related records such as orders, invoices, payments, and portal users will not be destroyed.
                    If this company has history it will be archived (set inactive) instead of permanently deleted.
                  </p>
                </>
              }
            >
              Delete Company
            </ConfirmAction>
          )}
        </div>
      </div>

      {removed === 'archived' && (
        <div className="p-3 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200">
          This company cannot be permanently deleted because it has existing orders/financial records. It was archived instead.
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex space-x-6 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`?tab=${t.id}`}
              className={`pb-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                tab === t.id ? 'border-[#4A235A] text-[#4A235A]' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === 'overview' && (
        canEdit ? (
          <form action={saveCompanyAction} className="bg-white p-6 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <h2 className="font-bold text-sm text-gray-900 md:col-span-2">Edit Company</h2>
            <label className="block">
              <span className="font-semibold text-gray-500">Name</span>
              <input name="name" required defaultValue={company.name} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <MobileSheetSelect
              name="industry"
              label="Industry"
              showDesktopLabel
              defaultValue={company.industry || ''}
              emptyLabel="Select Industry"
              options={[
                { value: '', label: 'Select Industry' },
                ...['IT', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Other'].map((industry) => ({
                  value: industry,
                  label: industry,
                })),
              ]}
            />
            <label className="block">
              <span className="font-semibold text-gray-500">Website</span>
              <input name="website" type="url" defaultValue={company.website || ''} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block">
              <span className="font-semibold text-gray-500">GST</span>
              <input name="gst_number" defaultValue={company.gst_number || ''} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block">
              <span className="font-semibold text-gray-500">City</span>
              <input name="city" defaultValue={company.city || ''} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block">
              <span className="font-semibold text-gray-500">State</span>
              <input name="state" defaultValue={company.state || ''} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block">
              <span className="font-semibold text-gray-500">Country</span>
              <input name="country" defaultValue={company.country || 'India'} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <MobileSheetSelect
              name="status"
              label="Status"
              showDesktopLabel
              defaultValue={company.status}
              options={[
                { value: 'prospect', label: 'Prospect' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
            <label className="block md:col-span-2">
              <span className="font-semibold text-gray-500">Address</span>
              <textarea name="address" rows={2} defaultValue={company.address || ''} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block md:col-span-2">
              <span className="font-semibold text-gray-500">Notes</span>
              <textarea name="notes" rows={3} defaultValue={company.notes || ''} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <p className="text-[11px] text-gray-500 md:col-span-2">
              Owner: {(company.owner as { full_name?: string } | null)?.full_name || 'Unassigned'}
            </p>
            <button type="submit" className="md:col-span-2 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-[#4A235A]">
              Save company
            </button>
          </form>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 text-xs space-y-3">
            <h2 className="font-bold text-sm text-gray-900 pb-2 border-b">Company Information</h2>
            <div><span className="font-semibold text-gray-500 w-24 inline-block">Owner:</span> {(company.owner as any)?.full_name || '?'}</div>
            <div><span className="font-semibold text-gray-500 w-24 inline-block">GST:</span> {company.gst_number || '?'}</div>
            <div><span className="font-semibold text-gray-500 w-24 inline-block">Address:</span> {company.address || '?'}</div>
            <div><span className="font-semibold text-gray-500 w-24 inline-block">City/State:</span> {company.city || '?'}, {company.state || 'India'}</div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 text-xs space-y-3">
            <h2 className="font-bold text-sm text-gray-900 pb-2 border-b">Relationship Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{company.notes || 'No notes added for this company yet.'}</p>
          </div>
        </div>
        )
      )}

      {tab === 'catalogue' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="font-bold text-sm text-gray-900">Catalogue for {company.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Portal users at this company see all global catalogue products ({globalProductCount || 0}) plus the personalized products listed below. Removing a company here hides a selected product from their portal.
              </p>
            </div>

            {canManageVisibility && (
            <form action={addProductAction} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <MobileSheetSelect
                name="product_id"
                label="Product"
                required
                className="w-full sm:w-64"
                emptyLabel="Select product to add..."
                options={[
                  { value: '', label: 'Select product to add...' },
                  ...unassignedProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
                ]}
              />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center px-3 py-2 text-xs font-semibold text-white bg-[#4A235A] hover:bg-[#3d1c4a] hover:text-white rounded-lg transition-colors whitespace-nowrap sm:w-auto"
              >
                <Plus size={14} className="inline mr-1" /> Assign Product
              </button>
            </form>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Personalized Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Price (?)</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">MOQ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Assigned On</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companyProducts?.map((cp: any) => (
                  <tr key={cp.product_id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <Link href={`/crm/products/${cp.product_id}`} className="flex items-center gap-3 group">
                        <ProductImage src={cp.product?.image_url} alt={cp.product?.name || 'Product'} size="xs" className="w-9 h-9 rounded-lg border border-gray-200" />
                        <div>
                          <p className="font-bold text-gray-900 group-hover:text-[#4A235A]">{cp.product?.name}</p>
                          <p className="font-mono text-[10px] text-gray-400">{cp.product?.sku}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {formatCurrency(cp.product?.price)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cp.product?.moq || 1} units
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(cp.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManageVisibility && (
                      <form action={removeProductAction} className="inline">
                        <input type="hidden" name="product_id" value={cp.product_id} />
                        <button
                          type="submit"
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title="Remove from this company's catalogue"
                        >
                          <Trash2 size={15} />
                        </button>
                      </form>
                      )}
                    </td>
                  </tr>
                ))}
                {(!companyProducts || companyProducts.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      No personalized products assigned to {company.name} yet. Standard catalogue items will be visible.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'clients' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
            <div>
              <h2 className="font-bold text-sm text-gray-900">Portal clients</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Each login is a Supabase Auth user assigned to this company. Passwords are never stored in CRM tables.
              </p>
            </div>
            {profile.role === 'admin' && <PortalClientForm companyId={company.id} />}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Client ID / Login email</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Role</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
                  {profile.role === 'admin' && (
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Login</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients?.map((client) => (
                  <tr key={client.id}>
                    <td className="px-4 py-2.5 font-medium">{client.full_name}</td>
                    <td className="px-4 py-2.5 text-gray-600 font-mono">{client.email}</td>
                    <td className="px-4 py-2.5 capitalize">{String(client.role).replace('_', ' ')}</td>
                    <td className="px-4 py-2.5">{client.is_active ? 'Active' : 'Inactive'}</td>
                    {profile.role === 'admin' && (
                      <td className="px-4 py-2.5">
                        <ManageClientLogin
                          companyId={company.id}
                          client={{
                            id: client.id,
                            full_name: client.full_name,
                            email: client.email || '',
                            role: String(client.role),
                            is_active: Boolean(client.is_active),
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {(!clients || clients.length === 0) && (
                  <tr><td colSpan={profile.role === 'admin' ? 5 : 4} className="p-6 text-center text-gray-400">No portal clients for this company yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-4">
          <form action={asFormAction(createContact)} className="bg-white p-4 rounded-xl border border-gray-200 grid md:grid-cols-3 gap-3 text-xs">
            <input type="hidden" name="company_id" value={company.id} />
            <input name="full_name" required placeholder="Full name" className="border rounded-lg px-3 py-2" />
            <input name="designation" placeholder="Designation" className="border rounded-lg px-3 py-2" />
            <input name="email" type="email" placeholder="Email" className="border rounded-lg px-3 py-2" />
            <input name="phone" placeholder="Phone" className="border rounded-lg px-3 py-2" />
            <MobileSheetSelect
              name="contact_type"
              label="Contact type"
              defaultValue="primary"
              options={[
                { value: 'primary', label: 'Primary' },
                { value: 'billing', label: 'Billing' },
                { value: 'procurement', label: 'Procurement' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <button className="bg-[#1A3022] text-white rounded-lg font-semibold py-2">Add contact</button>
          </form>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Name</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Designation</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Email</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts?.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-medium">{c.full_name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.designation || '?'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.email || '?'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.phone || '?'}</td>
                </tr>
              ))}
              {(!contacts || contacts.length === 0) && (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">No contacts added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Stage</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Est. Value</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Next Follow-up</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads?.map(l => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 capitalize font-semibold">{l.stage}</td>
                  <td className="px-4 py-2.5 font-bold">{formatCurrency(l.estimated_value)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{formatDate(l.next_follow_up_at)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{formatDate(l.created_at)}</td>
                </tr>
              ))}
              {(!leads || leads.length === 0) && (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">No leads recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'requirements' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Requirement Name</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Budget</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Quantity</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Deadline</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requirements?.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-semibold text-[#4A235A]">
                    <Link href={`/crm/requirements/${r.id}`}>{r.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-bold">{formatCurrency(r.budget)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.quantity || '?'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{formatDate(r.deadline)}</td>
                  <td className="px-4 py-2.5 capitalize">{r.status}</td>
                </tr>
              ))}
              {(!requirements || requirements.length === 0) && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">No requirements recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'quotations' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Quote #</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Total</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Valid Until</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotations?.map(q => (
                <tr key={q.id}>
                  <td className="px-4 py-2.5 font-semibold text-[#4A235A]">
                    <Link href={`/crm/quotations/${q.id}`}>{q.quotation_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-bold">{formatCurrency(q.total)}</td>
                  <td className="px-4 py-2.5 capitalize">{q.status}</td>
                  <td className="px-4 py-2.5 text-gray-500">{formatDate(q.valid_until)}</td>
                </tr>
              ))}
              {(!quotations || quotations.length === 0) && (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">No quotations generated yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Order #</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Value</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders?.map(o => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5 font-semibold text-[#4A235A]">
                    <Link href={`/crm/orders/${o.id}`}>{o.order_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-bold">{formatCurrency(o.order_value)}</td>
                  <td className="px-4 py-2.5 capitalize">{o.status}</td>
                  <td className="px-4 py-2.5 text-gray-500">{formatDate(o.created_at)}</td>
                </tr>
              ))}
              {(!orders || orders.length === 0) && (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">No orders placed yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tracking' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-bold text-sm text-gray-900">Order tracking</h2>
              <p className="text-[11px] text-gray-500">Live statuses from the existing order workflow. No simulated tracking.</p>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Order</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Progress</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders?.map((order) => {
                  const idx = lifecycleIndex(order.status)
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-2.5 font-semibold text-[#4A235A]">
                        <Link href={`/crm/orders/${order.id}`}>{order.order_number}</Link>
                      </td>
                      <td className="px-4 py-2.5">{CLIENT_STATUS_LABELS[order.status] || order.status}</td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {ORDER_LIFECYCLE.map((stage, i) => (i <= idx ? '●' : '○')).join(' ')}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{formatDate(order.expected_delivery_date)}</td>
                    </tr>
                  )
                })}
                {(!orders || orders.length === 0) && (
                  <tr><td colSpan={4} className="p-6 text-center text-gray-400">No orders to track yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-bold text-sm text-gray-900">Assigned work</h2>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Task</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Assignee</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companyTasks?.map((task) => {
                  const assignee = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee
                  return (
                    <tr key={task.id}>
                      <td className="px-4 py-2.5 font-medium">{task.title}</td>
                      <td className="px-4 py-2.5">{assignee?.full_name || 'Unassigned'}</td>
                      <td className="px-4 py-2.5 capitalize">{String(task.status || 'open').replace('_', ' ')}</td>
                      <td className="px-4 py-2.5">{formatDate(task.due_at)}</td>
                    </tr>
                  )
                })}
                {(!companyTasks || companyTasks.length === 0) && (
                  <tr><td colSpan={4} className="p-6 text-center text-gray-400">No tasks assigned for this company.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Invoice #</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Amount</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices?.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2.5 font-semibold text-[#4A235A]">
                    <Link href={`/crm/invoices/${inv.id}`}>{inv.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-bold">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-2.5 capitalize">{inv.status}</td>
                  <td className="px-4 py-2.5 text-gray-500">{formatDate(inv.created_at)}</td>
                </tr>
              ))}
              {(!invoices || invoices.length === 0) && (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400">No invoices recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
