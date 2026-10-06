import { TenantGateShell } from '../tenant-gate-shell'
import { appShortName } from '@/lib/brand'

export default async function TenantSuspendedPage() {
  const short = appShortName()
  return (
    <TenantGateShell
      title="Portal suspended"
      body={`This company portal is suspended or no longer active. Contact your ${short} account manager if you believe this is a mistake.`}
      cta={`Contact ${short}`}
    />
  )
}
