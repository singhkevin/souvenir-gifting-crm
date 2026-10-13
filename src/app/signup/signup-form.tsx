import { redirect } from 'next/navigation'

/** Public signup is business registration. Pending accounts wait for sales approval. */
export function SignupForm() {
  redirect('/business/register')
  return null
}
