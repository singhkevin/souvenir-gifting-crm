export const REGISTER_EMAIL_TAKEN = 'This email is already registered. Sign in instead.'
export const REGISTER_CAPTCHA = 'Captcha failed. Please try again.'
export const REGISTER_GSTIN = 'Invalid GSTIN. Check the 15-character number and try again.'
export const REGISTER_WORK_EMAIL = 'Use a work email. Free inboxes such as Gmail, Yahoo, and Outlook are not accepted.'
export const REGISTER_SERVER = 'Server error. Please try again shortly.'

/** Map a provider or database message to one of the four registration messages. */
export function mapRegistrationFailure(message: string | null | undefined): string {
  const text = String(message || '').toLowerCase()
  if (!text) return REGISTER_SERVER
  if (
    text.includes('email already') ||
    text.includes('already registered') ||
    text.includes('already been registered') ||
    text.includes('user already') ||
    (text.includes('duplicate') && text.includes('email'))
  ) {
    return REGISTER_EMAIL_TAKEN
  }
  if (text.includes('captcha') || text.includes('turnstile') || text.includes('not a robot')) {
    return REGISTER_CAPTCHA
  }
  if (text.includes('gstin') || text.includes('gst number') || text.includes('gst_number')) {
    return REGISTER_GSTIN
  }
  if (text.includes('work email')) return REGISTER_WORK_EMAIL
  return REGISTER_SERVER
}
