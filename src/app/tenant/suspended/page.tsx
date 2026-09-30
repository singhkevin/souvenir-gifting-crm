import { TenantGateShell } from '../tenant-gate-shell'

export default async function TenantSuspendedPage() {
  return (
    <TenantGateShell
      title="Portal suspended"
      body="This company portal is suspended or no longer active. Contact your Souvenir account manager if you believe this is a mistake."
      cta="Contact Souvenir"
    />
  )
}
