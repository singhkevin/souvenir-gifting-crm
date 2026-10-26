/** Local files and Supabase public objects can go through the image optimiser. */
export function optimisedImageSrc(src: string) {
  const path = src.split(/[?#]/)[0]
  if (path.toLowerCase().endsWith('.svg')) return false
  if (src.startsWith('/') && !src.startsWith('//')) return true
  try {
    const url = new URL(src)
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}
