import { redirect } from 'next/navigation'

export default function CatalogsRedirect() {
  redirect('/portal/gifts?tab=collections')
}
