import { redirect } from 'next/navigation'

export default function QuotationsRedirect() {
  redirect('/portal/quotes?tab=quotes')
}
