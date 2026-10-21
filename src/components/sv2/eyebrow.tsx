type EyebrowTone = 'muted' | 'saffron' | 'peach'

const tones: Record<EyebrowTone, string> = {
  muted: 'text-[#7C766F]',
  saffron: 'text-[#9E4300]',
  peach: 'text-[#FFB690]',
}

/**
 * SV2 Eyebrow — small uppercase sans label sitting above a block of content.
 * `sv2-label` already supplies the uppercase, tracking and weight.
 */
export function Eyebrow({
  children,
  tone = 'muted',
  className = '',
}: {
  children: React.ReactNode
  tone?: EyebrowTone
  className?: string
}) {
  return <span className={`block sv2-label ${tones[tone]} ${className}`}>{children}</span>
}
