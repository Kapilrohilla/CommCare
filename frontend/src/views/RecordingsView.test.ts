import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const list = vi.fn()
const playbackUrl = vi.fn()

vi.mock('../lib/services/integrations.service', () => ({
  recordingsService: {
    list: (...args: unknown[]) => list(...args),
    get: vi.fn(),
    playbackUrl: (...args: unknown[]) => playbackUrl(...args),
  },
}))
vi.mock('../stores/session', () => ({
  useSessionStore: () => ({ current: { token: 'tok' } }),
}))

import RecordingsView from './RecordingsView.vue'

const rows = [
  { id: 'rec-1', name: 'Welcome', status: 'active', sourceType: 'tts', ttsText: 'Hello caller', duration: 2 },
  { id: 'rec-2', name: 'Broken', status: 'failed', sourceType: 'tts', errorMessage: 'Polly said no' },
]

function mountView() {
  return mount(RecordingsView, { global: { stubs: { teleport: true } } })
}

describe('RecordingsView row details', () => {
  beforeEach(() => {
    list.mockReset()
    playbackUrl.mockReset()
    list.mockResolvedValue(rows)
    playbackUrl.mockResolvedValue({ url: 'https://signed.example/a.wav', expiresInSeconds: 3600 })
  })

  it('opens the details dialog with text and playback when a row is clicked', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('tbody tr')[0].trigger('click')
    await flushPromises()

    const dialog = wrapper.find('[aria-labelledby="recording-details-title"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('Hello caller')
    expect(playbackUrl).toHaveBeenCalledWith('rec-1', 'tok')
  })

  it('shows the failure reason when a failed row is clicked', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('tbody tr')[1].trigger('click')
    await flushPromises()

    expect(wrapper.find('[aria-labelledby="recording-details-title"]').text()).toContain('Polly said no')
  })

  it('opens the details dialog from the keyboard', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('tbody tr')[0].trigger('keydown', { key: 'Enter' })

    expect(wrapper.find('[aria-labelledby="recording-details-title"]').exists()).toBe(true)
  })

  it('opens only the actions dialog when the row menu button is clicked', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('tbody tr')[0].find('button[aria-label="Take action on system recording"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[aria-labelledby="recording-action-title"]').exists()).toBe(true)
    expect(wrapper.find('[aria-labelledby="recording-details-title"]').exists()).toBe(false)
    expect(playbackUrl).not.toHaveBeenCalled()
  })
})
