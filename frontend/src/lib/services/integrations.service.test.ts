import { beforeEach, describe, expect, it, vi } from 'vitest'

const request = vi.fn()
vi.mock('../api', () => ({ request: (...args: unknown[]) => request(...args) }))

import { webhooksService } from './integrations.service'

describe('webhooksService lifecycle', () => {
  beforeEach(() => {
    request.mockReset()
    request.mockResolvedValue(undefined)
  })

  it('enable PATCHes /webhook-registry/:id/enable', async () => {
    await webhooksService.enable('w1', 'tok')
    expect(request).toHaveBeenCalledWith('/webhook-registry/w1/enable', { method: 'PATCH', token: 'tok' })
  })

  it('disable PATCHes /webhook-registry/:id/disable', async () => {
    await webhooksService.disable('w1', 'tok')
    expect(request).toHaveBeenCalledWith('/webhook-registry/w1/disable', { method: 'PATCH', token: 'tok' })
  })

  it('remove DELETEs /webhook-registry/:id', async () => {
    await webhooksService.remove('w1', 'tok')
    expect(request).toHaveBeenCalledWith('/webhook-registry/w1', { method: 'DELETE', token: 'tok' })
  })
})
