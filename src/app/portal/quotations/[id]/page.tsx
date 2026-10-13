import { redirect } from 'next/navigation'

export default async function QuotationRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/portal/quotes/${id}`)
}
