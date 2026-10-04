import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const list = vi.fn()
const enable = vi.fn()
const disable = vi.fn()
const remove = vi.fn()

vi.mock('../lib/services/integrations.service', () => ({
  webhooksService: {
    list: (...a: unknown[]) => list(...a),
    create: vi.fn(),
    enable: (...a: unknown[]) => enable(...a),
    disable: (...a: unknown[]) => disable(...a),
    remove: (...a: unknown[]) => remove(...a),
  },
}))
vi.mock('../stores/session', () => ({
  useSessionStore: () => ({ current: { token: 'tok' } }),
}))

import WebhooksView from './WebhooksView.vue'

const base = { endpoint: 'https://x.test', method: 'post', triggerEvent: 'Click2Call.CalleeConnected' }
const active = { ...base, id: 'w-active', name: 'Active hook', status: 'active' }
const inactive = { ...base, id: 'w-inactive', name: 'Inactive hook', status: 'inactive' }
const blocked = { ...base, id: 'w-blocked', name: 'Blocked hook', status: 'blocked' }

function mountView() {
  return mount(WebhooksView, { global: { stubs: { teleport: true } } })
}
const row = (w: ReturnType<typeof mountView>, i: number) => w.findAll('tbody tr')[i]
const btn = (r: ReturnType<ReturnType<typeof mountView>['find']>, label: string) =>
  r.findAll('button').find((b) => b.text() === label || b.attributes('aria-label') === label)

describe('WebhooksView lifecycle actions', () => {
  beforeEach(() => {
    for (const m of [list, enable, disable, remove]) m.mockReset()
    list.mockResolvedValue([active, inactive, blocked])
  })

  it('shows Disable for active, Enable for inactive, and a disabled toggle with tooltip for blocked', async () => {
    const w = mountView()
    await flushPromises()
    expect(btn(row(w, 0), 'Disable')).toBeTruthy()
    expect(btn(row(w, 1), 'Enable')).toBeTruthy()
    const blockedToggle = row(w, 2).find('[data-testid="toggle-webhook"]')
    expect(blockedToggle.attributes('disabled')).toBeDefined()
    expect(blockedToggle.attributes('title')).toBe('Blocked webhooks cannot be changed')
    expect(btn(row(w, 2), 'Delete')?.attributes('disabled')).toBeUndefined()
  })

  it('disables an active webhook and reloads the list showing the new status', async () => {
    disable.mockResolvedValue({ ...active, status: 'inactive' })
    list.mockResolvedValueOnce([active, inactive, blocked]).mockResolvedValueOnce([{ ...active, status: 'inactive' }, inactive, blocked])
    const w = mountView()
    await flushPromises()
    await btn(row(w, 0), 'Disable')!.trigger('click')
    await flushPromises()
    expect(disable).toHaveBeenCalledWith('w-active', 'tok')
    expect(list).toHaveBeenCalledTimes(2)
    expect(btn(row(w, 0), 'Enable')).toBeTruthy()
    expect(row(w, 0).text()).toContain('inactive')
  })

  it('enables an inactive webhook', async () => {
    enable.mockResolvedValue({ ...inactive, status: 'active' })
    const w = mountView()
    await flushPromises()
    await btn(row(w, 1), 'Enable')!.trigger('click')
    await flushPromises()
    expect(enable).toHaveBeenCalledWith('w-inactive', 'tok')
  })

  it('does not call remove until the confirm dialog is confirmed; cancel does nothing', async () => {
    const w = mountView()
    await flushPromises()
    await btn(row(w, 0), 'Delete')!.trigger('click')
    expect(remove).not.toHaveBeenCalled()
    const dialog = w.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    await dialog.findAll('button').find((b) => b.text() === 'Cancel')!.trigger('click')
    expect(remove).not.toHaveBeenCalled()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('deletes after confirm and the row disappears after reload', async () => {
    remove.mockResolvedValue(undefined)
    list.mockResolvedValueOnce([active, inactive, blocked]).mockResolvedValueOnce([inactive, blocked])
    const w = mountView()
    await flushPromises()
    await btn(row(w, 0), 'Delete')!.trigger('click')
    await w.find('[role="dialog"]').findAll('button').find((b) => b.text() === 'Delete')!.trigger('click')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('w-active', 'tok')
    expect(w.text()).not.toContain('Active hook')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('shows an inline error and keeps the row status when a toggle fails', async () => {
    disable.mockRejectedValue(new Error('Webhook is blocked'))
    const w = mountView()
    await flushPromises()
    await btn(row(w, 0), 'Disable')!.trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('Webhook is blocked')
    expect(btn(row(w, 0), 'Disable')).toBeTruthy()
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('shows an inline error and keeps the row when delete fails', async () => {
    remove.mockRejectedValue(new Error('Delete exploded'))
    const w = mountView()
    await flushPromises()
    await btn(row(w, 0), 'Delete')!.trigger('click')
    await w.find('[role="dialog"]').findAll('button').find((b) => b.text() === 'Delete')!.trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('Delete exploded')
    expect(w.text()).toContain('Active hook')
  })

  it('disables the row buttons while a request is in flight', async () => {
    let resolve!: () => void
    disable.mockReturnValue(new Promise<void>((r) => (resolve = r)))
    const w = mountView()
    await flushPromises()
    await btn(row(w, 0), 'Disable')!.trigger('click')
    expect(btn(row(w, 0), 'Disable')?.attributes('disabled') ?? btn(row(w, 0), 'Disabling…')?.attributes('disabled')).toBeDefined()
    resolve()
    await flushPromises()
  })
})
