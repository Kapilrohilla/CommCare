import { describe, expect, it } from 'vitest'
import { redactSecrets, safeRecordingHref } from './redact'

describe('redactSecrets', () => {
  it('redacts credentials and strips recording query strings', () => {
    const redacted = redactSecrets({
      id: 'call-1',
      password: 'secret',
      signingSecret: 'abc',
      recordingUrl: 'https://cdn.example.com/file.wav?X-Amz-Signature=abc&token=1',
      nested: { accessToken: 'tok' },
    }) as Record<string, unknown>

    expect(redacted.password).toBe('[redacted]')
    expect(redacted.signingSecret).toBe('[redacted]')
    expect(redacted.recordingUrl).toBe('https://cdn.example.com/file.wav')
    expect((redacted.nested as Record<string, unknown>).accessToken).toBe('[redacted]')
    expect(JSON.stringify(redacted)).not.toContain('X-Amz-Signature')
    expect(JSON.stringify(redacted)).not.toContain('secret')
  })

  it('rejects unsafe recording hrefs', () => {
    expect(safeRecordingHref('https://cdn.example.com/a.wav')).toBe('https://cdn.example.com/a.wav')
    expect(safeRecordingHref('javascript:alert(1)')).toBeNull()
    expect(safeRecordingHref(null)).toBeNull()
  })
})
