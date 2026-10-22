import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { isGiftEmployeeRole } from '@/lib/roles'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { GiftChooser, type GiftChoiceItem } from '@/components/gifts/gift-chooser'
import { GiftItemPicker } from '@/components/gifts/gift-item-picker'
import { openGiftDomains, resolveGiftCompany } from '@/lib/gifts/company'
import { signInGiftEmployee, signUpGiftEmployee } from '../actions'

export const dynamic = 'force-dynamic'

const EXAMPLE_ITEMS: GiftChoiceItem[] = [
  {
    id: 'welcome-kit',
    title: 'Welcome kit',
    imageUrl: '/site/home-welcome-kit.webp',
    kind: 'combo',
    memberNames: ['Notebook', 'Bottle', 'Tee'],
    sizeOptions: [],
  },
  {
    id: 'bottle',
    title: 'Steel bottle',
    imageUrl: '/site/home-festive-cane.webp',
    kind: 'product',
    memberNames: [],
    sizeOptions: [],
  },
  {
    id: 'tee',
    title: 'Team tee',
    imageUrl: '/site/home-new-joiner.webp',
    kind: 'product',
    memberNames: [],
    sizeOptions: ['S', 'M', 'L', 'XL'],
  },
]

export default async function GiftJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  if (process.env.GIFT_UI_PREVIEW === '1') {
    return (
      <div className="space-y-10">
        <JoinForms companyName="Your company" slug="acme" domains={['tkion.com']} />
        <div className="space-y-3">
          <h2 className="font-serif text-2xl">Example choice screen</h2>
          <GiftChooser selectionId="preview" selectionName="Welcome gift" items={EXAMPLE_ITEMS} />
        </div>
        <div className="space-y-3 border border-[#E8E4DE] bg-white p-4">
          <h2 className="font-serif text-2xl">Example staff shortlist</h2>
          <GiftItemPicker
            products={[
              { id: '11111111-1111-4111-8111-111111111111', name: 'Welcome kit', sku: 'KIT-1', image_url: '/site/home-welcome-kit.webp' },
              { id: '22222222-2222-4222-8222-222222222222', name: 'Steel bottle', sku: 'BTL-1', image_url: '/site/home-festive-cane.webp' },
              { id: '33333333-3333-4333-8333-333333333333', name: 'Team tee', sku: 'TEE-1', image_url: '/site/home-new-joiner.webp' },
            ]}
          />
        </div>
      </div>
    )
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="border border-[#E8E4DE] bg-white p-6">
        <h1 className="font-serif text-3xl">Employee gift selection</h1>
        <p className="mt-3 text-sm text-[#5C6570]">Database configuration is missing, so sign-up is unavailable.</p>
      </div>
    )
  }

  const profile = await getProfile()
  if (profile && isGiftEmployeeRole(profile.role)) redirect('/gift')

  const { company: companySlug = '' } = await searchParams
  const company = await resolveGiftCompany(companySlug)
  if (!company) {
    return (
      <div className="border border-[#E8E4DE] bg-white p-6">
        <h1 className="font-serif text-3xl">Employee gift selection</h1>
        <p className="mt-3 text-sm text-[#5C6570]">
          Open the link from your company portal, for example your-company.giftingstore.online/gift/join.
        </p>
      </div>
    )
  }
  const open = await openGiftDomains(company.id)
  return <JoinForms companyName={company.name} slug={company.slug || ''} domains={open.domains} />
}

function JoinForms({
  companyName,
  slug,
  domains,
}: {
  companyName: string
  slug: string
  domains: string[]
}) {
  const domainLine = domains.length ? domains.map((domain) => `@${domain}`).join(', ') : 'your company email'
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#806A50]">{companyName}</p>
        <h1 className="mt-2 font-serif text-3xl">Choose your gift</h1>
        <p className="mt-2 text-sm text-[#5C6570]">Sign up with {domainLine}. Gmail and other public emails are blocked.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ActionForm action={signInGiftEmployee} className="space-y-3 border border-[#E8E4DE] bg-white p-4">
          <h2 className="font-medium">Sign in</h2>
          <input name="email" type="email" required placeholder="Email" className="w-full border px-3 py-2 text-sm" />
          <input name="password" type="password" required placeholder="Password" className="w-full border px-3 py-2 text-sm" />
          <SubmitButton className="bg-[#241C12] px-4 py-2 text-sm font-semibold text-white" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </ActionForm>
        <ActionForm action={signUpGiftEmployee} className="space-y-3 border border-[#E8E4DE] bg-white p-4">
          <h2 className="font-medium">Create account</h2>
          <input type="hidden" name="company_slug" value={slug} />
          <input name="full_name" required placeholder="Your name" className="w-full border px-3 py-2 text-sm" />
          <input name="email" type="email" required placeholder="Work email" className="w-full border px-3 py-2 text-sm" />
          <input name="password" type="password" required placeholder="Password" className="w-full border px-3 py-2 text-sm" />
          <input name="confirm_password" type="password" required placeholder="Confirm password" className="w-full border px-3 py-2 text-sm" />
          <SubmitButton className="bg-[#241C12] px-4 py-2 text-sm font-semibold text-white" pendingLabel="Creating…">
            Create account
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  )
}
