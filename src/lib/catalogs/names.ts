/** "Diwali 2026" -> "Diwali 2026 (copy)"; copying a copy keeps a single suffix. */
export function duplicateCatalogName(name: string) {
  const base = name.replace(/(?:\s*\(copy\)|\s+copy)+\s*$/i, '').trim() || name.trim()
  return `${base} (copy)`
}
