import { TenantGateShell } from '../tenant-gate-shell'
import { appShortName } from '@/lib/brand'

export default async function TenantTrialExpiredPage() {
  const short = appShortName()
  return (
    <TenantGateShell
      title="Trial ended"
      body={`Your company’s trial has ended. You can still sign in, but portal access is paused until your plan is upgraded. Please contact your ${short} account manager to continue.`}
      cta={`Talk to ${short}`}
    />
  )
}
