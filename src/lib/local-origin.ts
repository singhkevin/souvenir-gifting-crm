/** Hosts browsers resolve to 127.0.0.1 with no hosts-file entry. */
export function isLocalHostname(hostname: string) {
  const host = hostname.trim().toLowerCase()
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '::1'
  )
}

export function hostnameFromHostHeader(hostHeader: string | null | undefined) {
  const host = (hostHeader || '').split(',')[0].trim().toLowerCase()
  if (!host) return ''
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    return end === -1 ? host : host.slice(0, end + 1)
  }
  return host.replace(/:\d+$/, '')
}

/** Explicit port, then PORT, then the Next dev default. */
export function localDevPort(explicitPort = '') {
  const explicit = explicitPort.trim()
  if (/^\d+$/.test(explicit)) return explicit
  const fromEnv = (process.env.PORT || '').trim()
  if (/^\d+$/.test(fromEnv)) return fromEnv
  return '3000'
}

function hostnameForUrl(hostname: string) {
  return hostname === '::1' ? '[::1]' : hostname
}

/**
 * Loopback origins stay http and keep a port so auth links hit the dev server.
 * Public hosts stay https with no port.
 */
export function originForHostname(hostname: string, port = '') {
  if (isLocalHostname(hostname)) {
    return `http://${hostnameForUrl(hostname)}:${localDevPort(port)}`
  }
  return `https://${hostname}`
}
