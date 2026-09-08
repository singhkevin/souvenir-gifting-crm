import type { Metadata } from "next"
import type { ReactNode } from "react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Gifting Solutions — Corporate Gifting CRM",
  description: "Sign in to Gifting Solutions, the corporate gifting CRM.",
  applicationName: "Gifting Solutions",
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
