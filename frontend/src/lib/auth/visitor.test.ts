import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOrCreateVisitorId, getVisitorId } from './visitor'

const store = new Map<string, string>()

afterEach(() => {
  store.clear()
  vi.unstubAllGlobals()
})

describe('visitor id helper', () => {
  it('creates a visitorId on first visit and reuses it afterward', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
    })
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' })

    const first = getOrCreateVisitorId()
    const second = getOrCreateVisitorId()
    expect(first).toBe('11111111-1111-4111-8111-111111111111')
    expect(second).toBe(first)
    expect(getVisitorId()).toBe(first)
  })
})
