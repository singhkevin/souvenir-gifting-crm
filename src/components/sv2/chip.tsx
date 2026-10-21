/**
 * SV2 Chip — rectangular 1px border tag.
 * Variants: default (hairline), saffron, black.
 */
export function Chip({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode
  variant?: 'default' | 'saffron' | 'black'
  className?: string
}) {
  const styles = {
    default: 'border-[#CCC5BD] text-[#1C1C18] bg-[#F1EEE7]',
    saffron: 'border-[#9E4300] text-[#FCF9F2] bg-transparent',
    black: 'border-[#1C1B1A] text-[#FCF9F2] bg-[#1C1B1A]',
  }

  return (
    <span
      className={`inline-block border px-2 py-0.5 sv2-mono-sm ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
