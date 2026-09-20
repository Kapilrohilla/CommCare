const isSecure = typeof location !== 'undefined' && location.protocol === 'https:'

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 30): void {
  if (typeof document === 'undefined') return
  const secure = isSecure ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

export function clearCookie(name: string): void {
  if (typeof document === 'undefined') return
  const secure = isSecure ? '; Secure' : ''
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
}
