import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { CompanyAvatar } from '@/components/ui/avatar'
import { uploadCompanyLogo, removeCompanyLogo, updateCompany, removeCompany } from '../actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { formatAllowedEmailDomains } from '@/lib/pricing/domains'
import { portalAddressHelp, portalUrlForSlug } from '@/lib/portal-host'
import { portalDnsMode } from '@/lib/portal-hosts/mode'
import { requireStaff } from '@/lib/auth'
import { resolveListedPrices } from '@/lib/pricing/server'
import { createContact } from '@/app/crm/contacts/actions'
import { ActionForm } from '@/components/ui/action-form'
import { PortalClientForm } from '../portal-client-form'
import { ManageClientLogin } from '../manage-client-login'
import { PortalHostCard } from '../portal-host-card'
import { CLIENT_STATUS_LABELS, ORDER_LIFECYCLE, lifecycleIndex } from '@/lib/order-workflow'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import type { PortalHost } from '@/lib/portal-hosts/types'
import {
  CompanyCatalogueBrowser,
  type CatalogueBrowserProduct,
  type CatalogueBrowserRow,
} from '@/components/companies/company-catalogue-browser'
import { SubmitButton } from '@/components/ui/submit-button'
import { BusinessAccountPanel } from '../business-account-panel'
import { CompanySpecialPrices, type SpecialPriceRow } from '../special-prices'
import type { PickerProduct } from '@/components/products/product-picker-drawer'

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
  const canSetPrices = ['admin', 'sales', 'management', 'accounts'].includes(profile.role)

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
    { data: productExclusions },
    { data: clients },
    { data: companyTasks },
    { data: portalHosts },
    specialPricesResult,
  ] = await Promise.all([
    supabase.from('companies').select('*, owner:profiles!companies_owner_id_fkey(id, full_name, email)').eq('id', id).maybeSingle(),
    supabase.from('contacts').select('*').eq('company_id', id).order('full_name'),
    supabase.from('leads').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('requirements').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('quotations').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('orders').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, invoice_number, amount, status, created_at').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('company_product_access').select('product_id, created_at').eq('company_id', id),
    supabase
      .from('products')
      .select('id, name, sku, moq, image_url, catalogue_access, category:categories(name)')
      .eq('status', 'active')
      .order('name'),
    supabase.from('company_product_exclusions').select('product_id, created_at').eq('company_id', id),
    supabase.from('profiles').select('id, full_name, email, role, is_active').eq('company_id', id).in('role', ['client_admin', 'client_user']).order('full_name'),
    supabase.from('tasks').select('id, title, status, due_at, assigned_to, order_id, priority, assignee:profiles!assigned_to(full_name)').eq('company_id', id).order('due_at', { ascending: true }),
    supabase.from('portal_hosts').select('*').eq('company_id', id).neq('status', 'removed').order('created_at', { ascending: false }),
    supabase.from('company_product_prices').select('product_id, price, valid_until').eq('company_id', id),
  ])

  if (!company) notFound()

  const wildcardDns = portalDnsMode() === 'vercel'
  const hostRows = (portalHosts || []) as PortalHost[]
  const primaryHost = hostRows.find((h) => h.role === 'primary' && h.desired === 'parked') || null
  const redirectHosts = hostRows.filter((h) => h.role === 'redirect' || (h.desired === 'unparked' && h.role !== 'primary'))
  const primaryUrl = primaryHost ? portalUrlForSlug(primaryHost.slug) : null
  const redirectUrls = Object.fromEntries(
    redirectHosts.map((row) => [row.id, portalUrlForSlug(row.slug)]),
  )

  const productRows = (allProducts || []) as (CatalogueBrowserProduct & {
    category?: { name?: string | null } | { name?: string | null }[] | null
  })[]
  const specialMissing = Boolean(
    specialPricesResult.error && /company_product_prices|schema cache|does not exist/i.test(specialPricesResult.error.message),
  )
  // Picker price = this company's calculated price (products.price is frozen legacy data).
  const companyPortal = company.account_type === 'business' ? 'business' : 'corporate'
  const companyPrices = await resolveListedPrices(
    productRows.map((row) => ({ id: row.id })),
    companyPortal,
    company.margin_percent == null ? null : Number(company.margin_percent),
    company.id,
  )
  const pickerProducts: PickerProduct[] = productRows.map((row) => {
    const category = oneRelation(row.category)
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      imageUrl: row.image_url,
      category: category?.name || null,
      price: companyPrices?.get(row.id)?.price ?? 0,
      moq: row.moq && row.moq > 0 ? row.moq : 1,
    }
  })
  const productById = new Map(pickerProducts.map((product) => [product.id, product]))
  const specialRows: SpecialPriceRow[] = ((specialPricesResult.data || []) as {
    product_id: string
    price: number
    valid_until: string | null
  }[]).map((row) => {
    const product = productById.get(row.product_id)
    return {
      productId: row.product_id,
      name: product?.name || 'Product',
      sku: product?.sku || '',
      imageUrl: product?.imageUrl || null,
      price: Number(row.price) || 0,
      validUntil: row.valid_until,
    }
  })

  const assignedProductIds = new Set((companyProducts || []).map((cp) => cp.product_id))
  const excludedProductIds = new Set((productExclusions || []).map((e) => e.product_id))
  const products: CatalogueBrowserProduct[] = productRows.map((row) => ({ ...row, price: companyPrices?.get(row.id)?.price ?? null }))

  const catalogueRows: CatalogueBrowserRow[] = products
    .map((product) => {
      const granted = assignedProductIds.has(product.id)
      const excluded = excludedProductIds.has(product.id)
      const isGlobal = product.catalogue_access === 'all'
      const inBrowser = isGlobal || granted || excluded
      if (!inBrowser) return null
      const visible = (isGlobal || granted) && !excluded
      return {
        ...product,
        granted,
        excluded,
        visible,
        type: isGlobal ? ('global' as const) : ('personalized' as const),
      }
    })
    .filter((row): row is CatalogueBrowserRow => row !== null)

  const assignableProducts = products.filter(
    (p) =>
      p.catalogue_access !== 'all' &&
      !assignedProductIds.has(p.id) &&
      !excludedProductIds.has(p.id)
  )

  const visibleCatalogueCount = catalogueRows.filter((r) => r.visible).length

  const uploadLogoAction = async (formData: FormData) => {
    'use server'
    return await uploadCompanyLogo(formData)
  }

  const removeLogoAction = async (formData: FormData) => {
    'use server'
    return await removeCompanyLogo(formData)
  }

  const statusChip = (() => {
    switch (company.status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3A4537]" />
            Active
          </span>
        )
      case 'prospect':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9E4300]" />
            Prospect
          </span>
        )
      case 'inactive':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#FBEDEB] text-[#BA1A1A] border border-[#BA1A1A]/40 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BA1A1A]" />
            {company.status || 'Inactive'}
          </span>
        )
    }
  })()

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'clients', label: `Clients (${clients?.length || 0})` },
    { id: 'catalogue', label: `Catalogue (${visibleCatalogueCount})` },
    ...(canSetPrices ? [{ id: 'prices', label: `Special prices (${specialRows.length})` }] : []),
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

      {/* Header Panel */}
      <div className="bg-[#FCF9F2] p-6 border border-[#CCC5BD] rounded-none shadow-none flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#7C766F] mb-1.5">
            <Link href="/crm/dashboard" className="hover:text-[#9E4300] transition-colors">CRM</Link>
            <span>/</span>
            <Link href="/crm/companies" className="hover:text-[#9E4300] transition-colors">COMPANIES</Link>
            <span>/</span>
            <span className="text-[#9E4300] font-semibold">{company.name}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CompanyAvatar name={company.name} logoPath={company.logo_path} size="lg" />
            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A] truncate">
              {company.name}
            </h1>
            {statusChip}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4A4640] mt-1.5">
            <span>{company.industry || 'Corporate Client'}</span>
            <span aria-hidden="true" className="text-[#CCC5BD]">·</span>
            <span>{company.city || 'India'}</span>
            {company.website && (
              <>
                <span aria-hidden="true" className="text-[#CCC5BD]">·</span>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block truncate max-w-[200px] align-bottom text-[#9E4300] hover:underline font-mono"
                >
                  {company.website}
                </a>
              </>
            )}
          </div>

          <div className="flex flex-col items-start gap-2 mt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <ActionForm action={uploadLogoAction} successMessage="Logo updated" className="flex w-full items-center gap-2 sm:w-auto">
              <input type="hidden" name="company_id" value={company.id} />
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp"
                required
                className="min-w-0 flex-1 text-[11px] text-[#4A4640] file:mr-2 file:px-2 file:py-1 file:rounded-none file:border file:border-[#CCC5BD] file:bg-[#F6F3EC] file:text-[11px] file:font-bold file:uppercase file:tracking-[0.08em] file:text-[#1C1B1A] sm:flex-none"
              />
              <SubmitButton pendingLabel="Uploading…" className="shrink-0 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] rounded-none border border-[#1C1B1A] bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors shadow-none">
                {company.logo_path ? 'Change logo' : 'Upload logo'}
              </SubmitButton>
            </ActionForm>
            {company.logo_path && (
              <ActionForm action={removeLogoAction} successMessage="Logo removed">
                <input type="hidden" name="company_id" value={company.id} />
                <SubmitButton pendingLabel="Removing…" className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] rounded-none border border-[#BA1A1A]/40 text-[#BA1A1A] hover:bg-[#BA1A1A]/10 transition-colors shadow-none">
                  Remove
                </SubmitButton>
              </ActionForm>
            )}
            <span className="text-[10px] font-mono text-[#7C766F]">PNG, JPG or WebP · max 2 MB</span>
          </div>
        </div>

        {profile.role === 'admin' && (
          <div className="shrink-0">
            <ConfirmAction
              title="Remove company?"
              confirmLabel="Delete"
              action={removeCompany}
              hiddenFields={{ company_id: company.id }}
              description={
                <>
                  <p>
                    Company: <span className="font-semibold text-[#1C1B1A]">{company.name}</span>
                  </p>
                  <p>
                    Related records such as orders, invoices, payments, and portal users will not be destroyed.
                    If this company has history it will be set inactive instead of permanently deleted.
                  </p>
                </>
              }
            >
              Delete Company
            </ConfirmAction>
          </div>
        )}
      </div>

      {removed === 'archived' && (
        <div className="p-3 bg-[#FFB690]/20 text-[#9E4300] text-xs rounded-none border border-[#9E4300]/30 font-medium">
          This company cannot be permanently deleted because it has existing orders/financial records. It was set inactive instead.
        </div>
      )}

      <BusinessAccountPanel
        company={company}
        canAct={profile.role === 'admin' || (profile.role === 'sales' && company.owner_id === profile.id)}
      />

      <div className="border-b border-[#CCC5BD]">
        <nav className="flex space-x-6 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`?tab=${t.id}`}
              className={`pb-3 text-xs font-bold uppercase tracking-[0.12em] whitespace-nowrap transition-colors border-b-2 ${
                tab === t.id ? 'border-[#9E4300] text-[#9E4300]' : 'border-transparent text-[#7C766F] hover:text-[#1C1B1A]'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === 'overview' && (
        canEdit ? (
          <div className="space-y-6">
            <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
              <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
                <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
                  Edit Company
                </h2>
              </div>
              <ActionForm action={updateCompany.bind(null, id)} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <label className="block space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Name</span>
                  <input
                    name="name"
                    required
                    defaultValue={company.name}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
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
                <label className="block space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Website</span>
                  <input
                    name="website"
                    type="url"
                    defaultValue={company.website || ''}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">GST</span>
                  <input
                    name="gst_number"
                    defaultValue={company.gst_number || ''}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company margin %</span>
                  <input
                    name="margin_percent"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={company.margin_percent ?? ''}
                    placeholder="Uses org B2B default if empty"
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 font-mono"
                  />
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Allowed portal email domains</span>
                  <input
                    name="allowed_email_domains"
                    defaultValue={formatAllowedEmailDomains(company.allowed_email_domains)}
                    placeholder="e.g. acme.com, acme.co.in — leave empty for no restriction"
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                  <span className="mt-1 block text-[11px] text-[#7C766F]">
                    When set, portal client logins must use one of these domains.
                  </span>
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Portal address</span>
                  <input
                    name="portal_slug"
                    defaultValue={company.portal_slug || ''}
                    placeholder="acme"
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 font-mono"
                  />
                  <span className="mt-1 block text-[11px] text-[#7C766F]">
                    {portalAddressHelp(company.portal_slug || 'your-slug')}
                  </span>
                </label>
                <label className="flex items-start gap-2 md:col-span-2 text-xs text-[#4A4640]">
                  <input
                    type="checkbox"
                    name="notify_client_admins_on_live"
                    value="1"
                    defaultChecked={Boolean(primaryHost?.notify_client_admins)}
                    className="mt-0.5 rounded-none border-[#CCC5BD] text-[#1C1B1A] focus:ring-0"
                  />
                  <span>Email client admins when the portal goes live (staff who set the address are always notified).</span>
                </label>
                <label className="block space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">City</span>
                  <input
                    name="city"
                    defaultValue={company.city || ''}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">State</span>
                  <input
                    name="state"
                    defaultValue={company.state || ''}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Country</span>
                  <input
                    name="country"
                    defaultValue={company.country || 'India'}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
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
                <MobileSheetSelect
                  name="portal_status"
                  label="Portal status"
                  showDesktopLabel
                  defaultValue={company.portal_status || 'active'}
                  options={[
                    { value: 'trial', label: 'Trial' },
                    { value: 'active', label: 'Active' },
                    { value: 'suspended', label: 'Suspended' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                />
                <label className="block space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Trial ends</span>
                  <input
                    type="datetime-local"
                    name="trial_ends_at"
                    defaultValue={
                      company.trial_ends_at
                        ? new Date(company.trial_ends_at).toISOString().slice(0, 16)
                        : ''
                    }
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                  <span className="mt-1 block text-[11px] text-[#7C766F]">Used when portal status is Trial.</span>
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Address</span>
                  <textarea
                    name="address"
                    rows={2}
                    defaultValue={company.address || ''}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Notes</span>
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={company.notes || ''}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </label>
                <p className="text-[11px] uppercase tracking-wider text-[#7C766F] md:col-span-2">
                  Owner: <span className="font-semibold text-[#1C1B1A]">{(company.owner as { full_name?: string } | null)?.full_name || 'Unassigned'}</span>
                </p>
                <button
                  type="submit"
                  className="md:col-span-2 bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-xs font-bold uppercase tracking-[0.12em] py-2.5 shadow-none"
                >
                  Save company
                </button>
              </ActionForm>
            </div>
            <PortalHostCard
              companyId={company.id}
              primary={primaryHost}
              primaryUrl={primaryUrl}
              redirects={redirectHosts}
              redirectUrls={redirectUrls}
              canAdmin={profile.role === 'admin'}
              canResync={profile.role === 'admin'}
              wildcardDns={wildcardDns}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
              <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
                <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
                  Company Information
                </h2>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Owner</span>
                  <span className="mt-0.5 block text-[#1C1B1A]">{(company.owner as { full_name?: string | null } | null)?.full_name || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">GST</span>
                  <span className="mt-0.5 block font-mono text-[#1C1B1A]">{company.gst_number || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Margin %</span>
                  <span className="mt-0.5 block font-mono text-[#1C1B1A]">
                    {company.margin_percent != null ? `${company.margin_percent}%` : 'Org B2B default'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Domains</span>
                  <span className="mt-0.5 block text-[#1C1B1A]">
                    {formatAllowedEmailDomains(company.allowed_email_domains) || 'Any email'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Portal</span>
                  <span className="mt-0.5 block font-mono text-[#1C1B1A]">
                    {portalUrlForSlug(company.portal_slug) || company.portal_slug || 'Main site'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Address</span>
                  <span className="mt-0.5 block text-[#1C1B1A]">{company.address || '—'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">City / State</span>
                  <span className="mt-0.5 block text-[#1C1B1A]">{[company.city, company.state].filter(Boolean).join(', ') || '—'}</span>
                </div>
              </div>
            </div>

            <PortalHostCard
              companyId={company.id}
              primary={primaryHost}
              primaryUrl={primaryUrl}
              redirects={redirectHosts}
              redirectUrls={redirectUrls}
              canAdmin={profile.role === 'admin'}
              canResync={profile.role === 'admin'}
              wildcardDns={wildcardDns}
            />

            <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden md:col-span-2">
              <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
                <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
                  Relationship Notes
                </h2>
              </div>
              <div className="p-4 text-xs text-[#4A4640] leading-relaxed whitespace-pre-wrap">
                {company.notes || 'No notes added for this company yet.'}
              </div>
            </div>
          </div>
        )
      )}

      {tab === 'catalogue' && (
        <CompanyCatalogueBrowser
          companyId={id}
          companyName={company.name}
          rows={catalogueRows}
          assignableProducts={assignableProducts}
          canManageVisibility={canManageVisibility}
        />
      )}

      {tab === 'prices' && canSetPrices && (
        <CompanySpecialPrices
          companyId={id}
          products={pickerProducts}
          rows={specialRows}
          missingTable={specialMissing}
        />
      )}

      {tab === 'clients' && (
        <div className="space-y-6">
          <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
            <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
              <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
                Portal clients
              </h2>
              <p className="text-xs text-[#4A4640] mt-0.5">
                Each login is a Supabase Auth user assigned to this company. Passwords are never stored in CRM tables.
              </p>
            </div>
            {profile.role === 'admin' && (
              <div className="p-6">
                <PortalClientForm companyId={company.id} />
              </div>
            )}
          </div>

          <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
            <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1B1A]">
                Client Logins
              </h3>
              <span className="font-mono text-xs text-[#7C766F]">[ {clients?.length || 0} ]</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                  <tr>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Name</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Client ID / Login email</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Role</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
                    {profile.role === 'admin' && (
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Login</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CCC5BD]">
                  {clients?.map((client) => (
                    <tr key={client.id} className="hover:bg-[#F6F3EC] transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-[#1C1B1A]">{client.full_name}</td>
                      <td className="px-4 py-2.5 text-[#4A4640] font-mono">{client.email}</td>
                      <td className="px-4 py-2.5 capitalize text-[#4A4640]">{String(client.role).replace('_', ' ')}</td>
                      <td className="px-4 py-2.5">
                        {client.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20 rounded-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3A4537]" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] border border-[#CCC5BD] text-[#4A4640] bg-[#F6F3EC] rounded-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#7C766F]" />
                            Inactive
                          </span>
                        )}
                      </td>
                      {profile.role === 'admin' && (
                        <td className="px-4 py-2.5 text-right">
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
                    <tr>
                      <td colSpan={profile.role === 'admin' ? 5 : 4} className="p-6 text-center text-[#7C766F]">
                        No portal clients for this company yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-6">
          <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
            <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
              <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
                Add Contact
              </h2>
            </div>
            <ActionForm action={createContact} className="p-4 grid md:grid-cols-3 gap-3 text-xs" resetOnSuccess>
              <input type="hidden" name="company_id" value={company.id} />
              <input
                name="full_name"
                required
                placeholder="Full name"
                className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
              />
              <input
                name="designation"
                placeholder="Designation"
                className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
              />
              <input
                name="phone"
                placeholder="Phone"
                className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
              />
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
              <SubmitButton className="bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-xs font-bold uppercase tracking-[0.12em] py-2 shadow-none" pendingLabel="Adding…">
                Add contact
              </SubmitButton>
            </ActionForm>
          </div>

          <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
            <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1B1A]">
                Contacts
              </h3>
              <span className="font-mono text-xs text-[#7C766F]">[ {contacts?.length || 0} ]</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                  <tr>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Name</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Designation</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Email</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CCC5BD]">
                  {contacts?.map(c => (
                    <tr key={c.id} className="hover:bg-[#F6F3EC] transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-[#1C1B1A]">{c.full_name}</td>
                      <td className="px-4 py-2.5 text-[#4A4640]">{c.designation || '—'}</td>
                      <td className="px-4 py-2.5 text-[#4A4640]">{c.email || '—'}</td>
                      <td className="px-4 py-2.5 text-[#4A4640]">{c.phone || '—'}</td>
                    </tr>
                  ))}
                  {(!contacts || contacts.length === 0) && (
                    <tr><td colSpan={4} className="p-6 text-center text-[#7C766F]">No contacts added yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1B1A]">
              Leads
            </h3>
            <span className="font-mono text-xs text-[#7C766F]">[ {leads?.length || 0} ]</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                <tr>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Stage</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Est. Value</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Next Follow-up</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD]">
                {leads?.map(l => (
                  <tr key={l.id} className="hover:bg-[#F6F3EC] transition-colors">
                    <td className="px-4 py-2.5 capitalize font-semibold text-[#1C1B1A]">
                      <Link href={`/crm/leads/${l.id}`} className="hover:text-[#9E4300] transition-colors">
                        {l.stage}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-right text-[#1C1B1A]">{formatCurrency(l.estimated_value)}</td>
                    <td className="px-4 py-2.5 text-[#4A4640] font-mono">{formatDate(l.next_follow_up_at)}</td>
                    <td className="px-4 py-2.5 text-[#4A4640] font-mono">{formatDate(l.created_at)}</td>
                  </tr>
                ))}
                {(!leads || leads.length === 0) && (
                  <tr><td colSpan={4} className="p-6 text-center text-[#7C766F]">No leads recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'requirements' && (
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1B1A]">
              Requirements
            </h3>
            <span className="font-mono text-xs text-[#7C766F]">[ {requirements?.length || 0} ]</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                <tr>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Requirement Name</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Budget</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Quantity</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Deadline</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD]">
                {requirements?.map(r => (
                  <tr key={r.id} className="hover:bg-[#F6F3EC] transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-[#1C1B1A]">
                      <Link href={`/crm/requirements/${r.id}`} className="hover:text-[#9E4300] transition-colors">{r.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-right text-[#1C1B1A]">{formatCurrency(r.budget)}</td>
                    <td className="px-4 py-2.5 font-mono text-right text-[#1C1B1A]">{r.quantity || '—'}</td>
                    <td className="px-4 py-2.5 text-[#4A4640] font-mono">{formatDate(r.deadline)}</td>
                    <td className="px-4 py-2.5 capitalize text-[#1C1B1A]">{r.status}</td>
                  </tr>
                ))}
                {(!requirements || requirements.length === 0) && (
                  <tr><td colSpan={5} className="p-6 text-center text-[#7C766F]">No requirements recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'quotations' && (
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1B1A]">
              Quotations
            </h3>
            <span className="font-mono text-xs text-[#7C766F]">[ {quotations?.length || 0} ]</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                <tr>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Quote #</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Total</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Valid Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD]">
                {quotations?.map(q => (
                  <tr key={q.id} className="hover:bg-[#F6F3EC] transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold text-[#1C1B1A]">
                      <Link href={`/crm/quotations/${q.id}`} className="hover:text-[#9E4300] transition-colors">{q.quotation_number}</Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-right text-[#1C1B1A]">{formatCurrency(q.total)}</td>
                    <td className="px-4 py-2.5 capitalize text-[#1C1B1A]">{q.status}</td>
                    <td className="px-4 py-2.5 text-[#4A4640] font-mono">{formatDate(q.valid_until)}</td>
                  </tr>
                ))}
                {(!quotations || quotations.length === 0) && (
                  <tr><td colSpan={4} className="p-6 text-center text-[#7C766F]">No quotations generated yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1B1A]">
              Orders
            </h3>
            <span className="font-mono text-xs text-[#7C766F]">[ {orders?.length || 0} ]</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                <tr>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Order #</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Value</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD]">
                {orders?.map(o => (
                  <tr key={o.id} className="hover:bg-[#F6F3EC] transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold text-[#1C1B1A]">
                      <Link href={`/crm/orders/${o.id}`} className="hover:text-[#9E4300] transition-colors">{o.order_number}</Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-right text-[#1C1B1A]">{formatCurrency(o.order_value)}</td>
                    <td className="px-4 py-2.5 capitalize text-[#1C1B1A]">{o.status}</td>
                    <td className="px-4 py-2.5 text-[#4A4640] font-mono">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
                {(!orders || orders.length === 0) && (
                  <tr><td colSpan={4} className="p-6 text-center text-[#7C766F]">No orders placed yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'tracking' && (
        <div className="space-y-6">
          <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
            <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
              <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
                Order tracking
              </h2>
              <p className="text-xs text-[#4A4640] mt-0.5">Live statuses from the existing order workflow. No simulated tracking.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                  <tr>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Order</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Progress</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CCC5BD]">
                  {orders?.map((order) => {
                    const idx = lifecycleIndex(order.status)
                    return (
                      <tr key={order.id} className="hover:bg-[#F6F3EC] transition-colors">
                        <td className="px-4 py-2.5 font-mono font-semibold text-[#1C1B1A]">
                          <Link href={`/crm/orders/${order.id}`} className="hover:text-[#9E4300] transition-colors">{order.order_number}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-[#1C1B1A]">{CLIENT_STATUS_LABELS[order.status] || order.status}</td>
                        <td className="px-4 py-2.5 text-[#9E4300] font-mono tracking-widest">
                          {ORDER_LIFECYCLE.map((stage, i) => (i <= idx ? '●' : '○')).join(' ')}
                        </td>
                        <td className="px-4 py-2.5 text-[#4A4640] font-mono">{formatDate(order.expected_delivery_date)}</td>
                      </tr>
                    )
                  })}
                  {(!orders || orders.length === 0) && (
                    <tr><td colSpan={4} className="p-6 text-center text-[#7C766F]">No orders to track yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
            <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
              <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">
                Assigned work
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                  <tr>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Task</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Assignee</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CCC5BD]">
                  {companyTasks?.map((task) => {
                    const assignee = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee
                    return (
                      <tr key={task.id} className="hover:bg-[#F6F3EC] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-[#1C1B1A]">{task.title}</td>
                        <td className="px-4 py-2.5 text-[#4A4640]">{assignee?.full_name || 'Unassigned'}</td>
                        <td className="px-4 py-2.5 capitalize text-[#1C1B1A]">{String(task.status || 'open').replace('_', ' ')}</td>
                        <td className="px-4 py-2.5 text-[#4A4640] font-mono">{formatDate(task.due_at)}</td>
                      </tr>
                    )
                  })}
                  {(!companyTasks || companyTasks.length === 0) && (
                    <tr><td colSpan={4} className="p-6 text-center text-[#7C766F]">No tasks assigned for this company.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1B1A]">
              Invoices
            </h3>
            <span className="font-mono text-xs text-[#7C766F]">[ {invoices?.length || 0} ]</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                <tr>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Invoice #</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Amount</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD]">
                {invoices?.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#F6F3EC] transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold text-[#1C1B1A]">
                      <Link href={`/crm/invoices/${inv.id}`} className="hover:text-[#9E4300] transition-colors">{inv.invoice_number}</Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-right text-[#1C1B1A]">{formatCurrency(inv.amount)}</td>
                    <td className="px-4 py-2.5 capitalize text-[#1C1B1A]">{inv.status}</td>
                    <td className="px-4 py-2.5 text-[#4A4640] font-mono">{formatDate(inv.created_at)}</td>
                  </tr>
                ))}
                {(!invoices || invoices.length === 0) && (
                  <tr><td colSpan={4} className="p-6 text-center text-[#7C766F]">No invoices recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
