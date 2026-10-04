import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SystemRecording } from '../lib/services/integrations.service'

const playbackUrl = vi.fn()

vi.mock('../lib/services/integrations.service', () => ({
  recordingsService: { playbackUrl: (...args: unknown[]) => playbackUrl(...args) },
}))
vi.mock('../stores/session', () => ({
  useSessionStore: () => ({ current: { token: 'tok' } }),
}))

import SystemRecordingDetailsDialog from './SystemRecordingDetailsDialog.vue'

function recording(overrides: Partial<SystemRecording> = {}): SystemRecording {
  return {
    id: 'rec-1',
    name: 'Welcome greeting',
    status: 'active',
    sourceType: 'tts',
    ttsText: 'Thank you for calling Acme.',
    duration: 3,
    format: 'wav',
    sampleRate: 8000,
    channels: 1,
    errorMessage: null,
    ...overrides,
  }
}

function mountDialog(rec: SystemRecording | null, open = true) {
  return mount(SystemRecordingDetailsDialog, {
    props: { open, recording: rec },
    global: { stubs: { teleport: true } },
  })
}

describe('SystemRecordingDetailsDialog', () => {
  beforeEach(() => {
    playbackUrl.mockReset()
    playbackUrl.mockResolvedValue({ url: 'https://signed.example/audio.wav', expiresInSeconds: 3600 })
  })

  it('shows name, status, text and format for an active TTS recording and loads playback once', async () => {
    const wrapper = mountDialog(recording())
    await flushPromises()

    expect(wrapper.text()).toContain('Welcome greeting')
    expect(wrapper.text()).toContain('active')
    expect(wrapper.text()).toContain('Thank you for calling Acme.')
    expect(wrapper.text()).toContain('3s')
    expect(wrapper.text()).toContain('wav')
    expect(playbackUrl).toHaveBeenCalledTimes(1)
    expect(playbackUrl).toHaveBeenCalledWith('rec-1', 'tok')
    expect(wrapper.find('audio').attributes('src')).toBe('https://signed.example/audio.wav')
  })

  it('shows the failure reason and no player for a failed recording', async () => {
    const wrapper = mountDialog(recording({ status: 'failed', errorMessage: 'Polly said no' }))
    await flushPromises()

    expect(wrapper.text()).toContain('Polly said no')
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(playbackUrl).not.toHaveBeenCalled()
  })

  it('says audio is not ready and does not fetch while processing', async () => {
    const wrapper = mountDialog(recording({ status: 'processing' }))
    await flushPromises()

    expect(wrapper.text()).toContain('Audio is not ready yet')
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(playbackUrl).not.toHaveBeenCalled()
  })

  it('shows an inline error when the playback URL cannot be loaded', async () => {
    playbackUrl.mockRejectedValue(new Error('nope'))
    const wrapper = mountDialog(recording())
    await flushPromises()

    expect(wrapper.text()).toContain('Playback could not be loaded')
    expect(wrapper.find('audio').exists()).toBe(false)
  })

  it('omits the text block for uploaded recordings', async () => {
    const wrapper = mountDialog(recording({ sourceType: 'upload', ttsText: null }))
    await flushPromises()

    expect(wrapper.text()).not.toContain('Text')
    expect(wrapper.find('audio').exists()).toBe(true)
  })

  it('renders nothing and fetches nothing when closed', async () => {
    const wrapper = mountDialog(recording(), false)
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(playbackUrl).not.toHaveBeenCalled()
  })

  it('fetches playback when a processing recording becomes active', async () => {
    const wrapper = mountDialog(recording({ status: 'processing' }))
    await flushPromises()
    expect(playbackUrl).not.toHaveBeenCalled()

    await wrapper.setProps({ recording: recording({ status: 'active' }) })
    await flushPromises()

    expect(playbackUrl).toHaveBeenCalledTimes(1)
    expect(wrapper.find('audio').exists()).toBe(true)
  })

  it('emits cancel from the close button', async () => {
    const wrapper = mountDialog(recording())
    await flushPromises()

    await wrapper.find('button[aria-label="Close"]').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
