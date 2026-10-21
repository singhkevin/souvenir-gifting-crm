import { BrandName } from '@/components/brand/brand-name'
import { jetbrainsMono, newsreader, plusJakarta } from '@/lib/fonts'

export const dynamic = 'force-dynamic'

export default function GiftLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`sv2 ${newsreader.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} min-h-screen bg-[#FCF9F2] text-[#1C1B1A] font-sans antialiased`}
    >
      <header className="border-b border-[#CCC5BD] bg-[#FCF9F2]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <BrandName className="font-serif text-xl" />
          <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#9E4300]">Employee gift</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}
