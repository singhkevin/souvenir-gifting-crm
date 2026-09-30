import Link from 'next/link'
import { headers } from 'next/headers'
import { mainOrigin } from '@/lib/portal-host'

export async function TenantGateShell({
  title,
  body,
  cta = 'Go to Souvenir',
}: {
  title: string
  body: string
  cta?: string
}) {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  const href = mainOrigin(host)

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-6">
      <div className="max-w-md w-full text-center">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#806A50]">Souvenir</p>
        <h1 className="mt-3 text-2xl font-semibold text-[#1C1917]">{title}</h1>
        <p className="mt-3 text-sm text-[#57534E] leading-relaxed">{body}</p>
        <Link
          href={href}
          className="inline-block mt-6 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#806A50] text-white hover:bg-[#9C8567] hover:text-white transition-colors"
        >
          {cta}
        </Link>
      </div>
    </div>
  )
}
