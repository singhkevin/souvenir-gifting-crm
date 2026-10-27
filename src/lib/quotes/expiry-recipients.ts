const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Contact email wins, matching quotes that were sent to a contact.
 * Portal and business quotes often have no contact; those go to the account users.
 */
export function quoteExpiryRecipientEmails(input: {
  contactEmail?: string | null
  accountEmails?: (string | null | undefined)[]
}): string[] {
  const contact = input.contactEmail?.trim()
  if (contact && EMAIL.test(contact)) return [contact]
  const seen = new Set<string>()
  const emails: string[] = []
  for (const raw of input.accountEmails || []) {
    const email = raw?.trim()
    if (!email || !EMAIL.test(email)) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    emails.push(email)
  }
  return emails
}
