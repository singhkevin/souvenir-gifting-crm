const RESEND_API_URL = 'https://api.resend.com/emails'

/**
 * Sender address for transactional email. `onboarding@resend.dev` works
 * out of the box for testing, but only delivers to the Resend account's
 * own verified address — verify a real sending domain in the Resend
 * dashboard and set RESEND_FROM_EMAIL to send to arbitrary recipients.
 */
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Souvenir Gifting Solutions <onboarding@resend.dev>'

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { error: 'Email delivery is not configured.' }
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[resend] send failed:', res.status, body)
      return { error: 'Unable to send email right now.' }
    }
    return {}
  } catch (err) {
    console.error('[resend] send threw:', err instanceof Error ? err.message : err)
    return { error: 'Unable to send email right now.' }
  }
}

export function passwordResetEmailHtml({ actionLink }: { actionLink: string }) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1B2430;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">Reset your password</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #5C6570;">
        We received a request to reset the password for your Souvenir Gifting Solutions account.
        Click the button below to choose a new password. This link expires in 1 hour.
      </p>
      <p style="margin: 28px 0;">
        <a href="${actionLink}"
           style="background:#806A50;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">
          Reset password
        </a>
      </p>
      <p style="font-size: 12px; line-height: 1.6; color: #8A929C;">
        If you did not request this, you can safely ignore this email — your password will not change.
      </p>
    </div>
  `
}
