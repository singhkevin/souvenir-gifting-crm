import { redirect } from 'next/navigation'

export default async function OfferingRedirect({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params
  redirect(`/portal/gifts/${sku}`)
}
