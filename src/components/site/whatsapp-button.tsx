import { whatsAppHref } from '@/lib/contact/public-phone'

/** Hidden when PUBLIC_CONTACT_PHONE and org_settings.public_contact_phone are both blank. */
export function WhatsAppButton({ phone }: { phone?: string | null }) {
  const href = phone ? whatsAppHref(phone) : null
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 border border-[#25D366] bg-[#1C1B1A] py-2 pl-3 pr-4 text-[#FCF9F2] hover:bg-[#25D366] hover:text-[#1C1B1A] transition-colors sm:bottom-6 sm:right-6"
    >
      <span className="flex h-6 w-6 items-center justify-center text-[#25D366] group-hover:text-inherit" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l6-1.6A11 11 0 0 0 20.5 3.5zm-8.5 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-3.5.9.9-3.4-.2-.3A9.1 9.1 0 1 1 12 20.5zm5-6.8c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5l-.9-2.1c-.2-.5-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4 15 15 0 0 0 1.5.5 3.6 3.6 0 0 0 1.7.1 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z" />
        </svg>
      </span>
      <span className="text-left leading-tight">
        <span className="block text-xs font-semibold uppercase tracking-wider">WhatsApp</span>
        <span className="hidden font-sans text-[10px] uppercase tracking-wider sm:block opacity-80">Support Desk</span>
      </span>
    </a>
  )
}
