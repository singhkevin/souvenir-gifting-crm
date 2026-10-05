import { redirect } from 'next/navigation'

export default async function CampaignDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/crm/catalogs/${id}`)
}
