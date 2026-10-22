/** Splits "a *b* c" into plain and accent parts. Unmatched asterisks stay as text. */
export function headingParts(heading: string): { text: string; accent: boolean }[] {
  const parts: { text: string; accent: boolean }[] = []
  const pattern = /\*([^*]+)\*/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(heading))) {
    if (match.index > last) parts.push({ text: heading.slice(last, match.index), accent: false })
    parts.push({ text: match[1], accent: true })
    last = match.index + match[0].length
  }
  if (last < heading.length) parts.push({ text: heading.slice(last), accent: false })
  return parts
}

export function plainHeading(heading: string) {
  return headingParts(heading).map((part) => part.text).join('')
}
