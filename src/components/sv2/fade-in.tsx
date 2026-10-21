'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Wraps children in a fade-in-on-scroll container.
 * Uses IntersectionObserver to add .sv2-visible when the element enters the viewport.
 * Respects prefers-reduced-motion via CSS (the class is still toggled, but CSS disables the transition).
 */
export function FadeIn({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'footer' | 'aside'
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Skip if user prefers reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('sv2-visible')
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('sv2-visible')
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag ref={ref} className={`sv2-fade-in ${className}`}>
      {children}
    </Tag>
  )
}
