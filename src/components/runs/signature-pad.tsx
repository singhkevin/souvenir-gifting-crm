'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

export type SignaturePadHandle = { isEmpty: () => boolean; canvas: () => HTMLCanvasElement | null; clear: () => void }

/** Finger / mouse signature box. Drawn in black on white so the saved PNG reads well. */
export const SignaturePad = forwardRef<SignaturePadHandle, { label?: string }>(function SignaturePad({ label = 'Receiver signature' }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }
  const ctx = () => {
    const c = canvasRef.current
    const g = c?.getContext('2d')
    if (g) {
      g.lineWidth = 3
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.strokeStyle = '#111111'
    }
    return g
  }
  const clear = () => {
    const c = canvasRef.current
    const g = c?.getContext('2d')
    if (c && g) {
      g.fillStyle = '#FFFFFF'
      g.fillRect(0, 0, c.width, c.height)
    }
    setEmpty(true)
  }

  useImperativeHandle(ref, () => ({ isEmpty: () => empty, canvas: () => canvasRef.current, clear }), [empty])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#1C1C18]">{label}</span>
        <button type="button" onClick={clear} className="text-[#9E4300] underline">Clear</button>
      </div>
      <canvas
        ref={(el) => {
          canvasRef.current = el
          if (el && empty) {
            const g = el.getContext('2d')
            if (g) {
              g.fillStyle = '#FFFFFF'
              g.fillRect(0, 0, el.width, el.height)
            }
          }
        }}
        width={600}
        height={200}
        aria-label={label}
        className="h-32 w-full touch-none border border-[#D8CFC2] bg-white"
        onPointerDown={(e) => {
          const g = ctx()
          if (!g) return
          drawing.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          const p = point(e)
          g.beginPath()
          g.moveTo(p.x, p.y)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const g = ctx()
          if (!g) return
          const p = point(e)
          g.lineTo(p.x, p.y)
          g.stroke()
          if (empty) setEmpty(false)
        }}
        onPointerUp={() => {
          drawing.current = false
        }}
        onPointerLeave={() => {
          drawing.current = false
        }}
      />
    </div>
  )
})
