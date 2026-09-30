import { TenantGateShell } from '../tenant-gate-shell'

export default async function TenantTrialExpiredPage() {
  return (
    <TenantGateShell
      title="Trial ended"
      body="Your company’s trial has ended. You can still sign in, but portal access is paused until your plan is upgraded. Please contact your Souvenir account manager to continue."
      cta="Talk to Souvenir"
    />
  )
}
