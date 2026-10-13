'use client'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold print:hidden"
    >
      Print
    </button>
  )
}
