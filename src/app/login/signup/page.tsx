import { currentTenantSignupCompany } from '@/lib/portal/signup-server'
import { PortalSignupForm } from './signup-form'

export const dynamic = 'force-dynamic'

export default async function PortalSignupPage() {
  const loaded = await currentTenantSignupCompany()
  if ('error' in loaded) {
    return (
      <PortalSignupForm
        companyName="Company portal"
        domains={[]}
        blocked={loaded.error}
      />
    )
  }
  const domains = (loaded.company.allowed_email_domains || []).map((entry) => entry.trim()).filter(Boolean)
  return (
    <PortalSignupForm
      companyName={loaded.company.name}
      domains={domains}
      blocked={loaded.refusal || (domains.length ? null : 'This company has not listed an email domain for sign-up. Ask your administrator.')}
    />
  )
}
