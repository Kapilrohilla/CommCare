import { describe, expect, it } from 'vitest'
import { canAccess } from './permissions'

describe('screen permissions', () => {
  it('keeps tenant context screens available to operators where appropriate', () => {
    expect(canAccess('dialer', 'operator')).toBe(true)
    expect(canAccess('trunks', 'operator')).toBe(false)
  })

  it('allows platform administrators to inspect system health', () => {
    expect(canAccess('health', 'platform-administrator')).toBe(true)
  })
})
