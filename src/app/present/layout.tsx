import { BrandName } from '@/components/brand/brand-name'

export default function PresentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F6F4F1] text-[#1B2430]">
      <header className="border-b border-[#E8E4DE] bg-white">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4">
          <BrandName />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}
