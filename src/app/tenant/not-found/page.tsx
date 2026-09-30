import { TenantGateShell } from '../tenant-gate-shell'

export default async function TenantNotFoundPage() {
  return (
    <TenantGateShell
      title="Portal not found"
      body="We could not find a company portal at this address. Check the link you were given, or visit our main site."
    />
  )
}
