import type { Metadata } from "next"
import type { ReactNode } from "react"
import { appName } from "@/lib/brand"

export const dynamic = "force-dynamic"

const name = appName()

export const metadata: Metadata = {
  title: { absolute: `${name} — Corporate Gifting CRM` },
  description: `Sign in to ${name}, the corporate gifting CRM.`,
  applicationName: name,
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
