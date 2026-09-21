function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const value = Number(part)
    if (value > 255) return null
    octets.push(value)
  }
  return octets as [number, number, number, number]
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')

  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  ) {
    return true
  }

  const v4 = parseIpv4(host)
  if (v4) {
    const [a, b] = v4
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    return false
  }

  if (host.includes(':')) {
    if (host === '::1' || host === '::') return true
    if (host.startsWith('fe80')) return true
    if (host.startsWith('fc') || host.startsWith('fd')) return true
  }

  return false
}
