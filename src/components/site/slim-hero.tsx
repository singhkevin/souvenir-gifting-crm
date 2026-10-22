import Image from 'next/image'
import Link from 'next/link'

export function SlimHero() {
  return (
    <section className="bg-[#F6F4F1]">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#806A50]">Corporate gifts</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight text-[#241C12] sm:text-4xl">Gifts teams remember.</h1>
          <Link href="/catalogue" className="mt-3 inline-block text-sm font-medium text-[#806A50] underline">
            Browse the catalogue
          </Link>
        </div>
        <div className="hidden h-24 w-40 overflow-hidden sm:block">
          <Image src="/site/home-welcome-kit.webp" alt="" width={160} height={96} className="h-full w-full object-cover" />
        </div>
      </div>
    </section>
  )
}
