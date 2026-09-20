export function redactSecrets(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(redactSecrets)
  if (!input || typeof input !== 'object') return input
  const blocked = new Set([
    'password',
    'secret',
    'token',
    'accessToken',
    'refreshToken',
    'signingSecret',
    'authorization',
  ])
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (blocked.has(key) || /secret|password|token/i.test(key)) {
      result[key] = '[redacted]'
      continue
    }
    if (key === 'recordingUrl' && typeof value === 'string') {
      try {
        const url = new URL(value)
        url.search = ''
        url.hash = ''
        result[key] = url.toString()
      } catch {
        result[key] = '[recording-url]'
      }
      continue
    }
    result[key] = redactSecrets(value)
  }
  return result
}

export function safeRecordingHref(url?: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return url
  } catch {
    return null
  }
}
