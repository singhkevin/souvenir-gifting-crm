/**
 * Neutral placeholder tile for proof/brand sections where real content
 * is not yet available. Renders as a hairline-bordered linen box with
 * muted mono text.
 */
export function PlaceholderTile({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-center border border-[#CCC5BD] bg-[#F6F3EC] p-4 ${className}`}
    >
      <span className="sv2-mono-sm text-[#4A4640] text-center">{text}</span>
    </div>
  )
}
