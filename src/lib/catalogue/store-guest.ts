/**
 * The retail cart form keeps snake_case keys. Guest checkout expects camelCase.
 * Company is optional: an empty company is stored under the guest's own name.
 */

export type StoreCartForm = {
  full_name: string
  email: string
  company_name: string
  phone: string
  fax: string
}

export function storeCartCheckoutInput<TLines>(
  form: StoreCartForm,
  lines: TLines,
  idempotencyKey: string,
) {
  return {
    fullName: form.full_name,
    email: form.email,
    companyName: form.company_name,
    phone: form.phone,
    fax: form.fax,
    lines,
    idempotencyKey,
  }
}

function clean(value: string | undefined) {
  return String(value || '').trim()
}

export function storeGuestContact(input: {
  fullName?: string
  email?: string
  companyName?: string
  phone?: string
}):
  | { error: string }
  | { fullName: string; email: string; companyName: string; phone: string } {
  const fullName = clean(input.fullName)
  const email = clean(input.email).toLowerCase()
  const companyName = clean(input.companyName) || clean(input.fullName)
  const phone = clean(input.phone)
  if (!fullName) return { error: 'Please share your name.' }
  if (!email || !email.includes('@')) return { error: 'Please share a valid email.' }
  if (!companyName) return { error: 'Please share your company name.' }
  return { fullName, email, companyName, phone }
}
