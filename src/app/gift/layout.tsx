import { BrandName } from '@/components/brand/brand-name'

export const dynamic = 'force-dynamic'

export default function GiftLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F6F4F1] text-[#1B2430]">
      <header className="border-b border-[#E8E4DE] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <BrandName className="font-serif text-xl" />
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#806A50]">Employee gift</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}
