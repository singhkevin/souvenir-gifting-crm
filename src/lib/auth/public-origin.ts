function firstForwardedValue(value: string | null | undefined) {
  if (!value) return ''
  return value.split(',')[0].trim()
}

/**
 * Public origin for links we hand to clients.
 * Proxies often send a comma-separated forwarded list; only the first hop is the browser host.
 */
export function originFromForwarded(hostHeader: string | null | undefined, protoHeader: string | null | undefined) {
  const host = firstForwardedValue(hostHeader)
  if (!host) return 'http://localhost:3000'
  const forwardedProto = firstForwardedValue(protoHeader).toLowerCase()
  const localhost = host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')
  const proto = forwardedProto === 'http' || forwardedProto === 'https'
    ? forwardedProto
    : localhost ? 'http' : 'https'
  return `${proto}://${host}`
}
