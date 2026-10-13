import { SiteShell } from '@/components/site/site-shell'
import { RegisterForm } from './register-form'

export const dynamic = 'force-dynamic'

export default function BusinessRegisterPage() {
  return (
    <SiteShell>
      <RegisterForm />
    </SiteShell>
  )
}
