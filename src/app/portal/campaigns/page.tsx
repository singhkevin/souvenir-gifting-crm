import { redirect } from 'next/navigation'

export default function CampaignsRedirect() {
  redirect('/portal/gifts?tab=collections')
}
