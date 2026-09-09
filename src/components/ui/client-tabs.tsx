'use client'

import { useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

function getScrollParent(el: HTMLElement | null): HTMLElement {
  let node = el?.parentElement ?? null
  while (node) {
    const { overflowY } = window.getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return (document.scrollingElement as HTMLElement) || document.documentElement
}

export function ClientTabs({
  tabs,
  initialTab,
  panels,
  className = '',
  activeClassName = 'border-[#1A3022] text-[#1A3022]',
  idleClassName = 'border-transparent text-gray-500',
}: {
  tabs: string[]
  initialTab: string
  panels: Record<string, ReactNode>
  className?: string
  activeClassName?: string
  idleClassName?: string
}) {
  const pathname = usePathname()
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState(() => (tabs.includes(initialTab) ? initialTab : tabs[0] || ''))

  function select(next: string) {
    if (next === tab) return
    setTab(next)
    // Update the URL without a Next.js navigation so we control scroll ourselves.
    const url = `${pathname}?tab=${encodeURIComponent(next)}`
    window.history.replaceState(window.history.state, '', url)

    requestAnimationFrame(() => {
      const root = rootRef.current
      const panel = panelRef.current
      if (!root || !panel) return

      const scroller = getScrollParent(root)
      const scrollerIsDoc = scroller === document.documentElement || scroller === document.body
      const viewTop = scrollerIsDoc ? 0 : scroller.getBoundingClientRect().top
      const viewBottom = scrollerIsDoc ? window.innerHeight : scroller.getBoundingClientRect().bottom
      const rootTop = root.getBoundingClientRect().top
      const panelBottom = panel.getBoundingClientRect().bottom
      const available = viewBottom - rootTop
      const needed = root.getBoundingClientRect().height

      // Short panels: keep current scroll. Tall panels: bring the tab section into view
      // so the extra content can be reached by scrolling the main pane.
      if (needed > available + 24 || panelBottom > viewBottom - 8 || rootTop < viewTop + 4) {
        const delta = rootTop - viewTop - 12
        if (scrollerIsDoc) {
          window.scrollBy({ top: delta, behavior: 'smooth' })
        } else {
          scroller.scrollBy({ top: delta, behavior: 'smooth' })
        }
      }
    })
  }

  return (
    <div ref={rootRef} className={className}>
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label="Sections">
          {tabs.map((item) => {
            const active = tab === item
            return (
              <button
                key={item}
                type="button"
                onClick={() => select(item)}
                className={`pb-3 text-xs font-semibold capitalize transition-colors border-b-2 ${
                  active ? activeClassName : idleClassName
                }`}
              >
                {item}
              </button>
            )
          })}
        </nav>
      </div>
      <div ref={panelRef} className="mt-6 overflow-visible pb-8">
        {panels[tab] ?? null}
      </div>
    </div>
  )
}
