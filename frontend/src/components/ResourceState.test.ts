import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ResourceState from './ResourceState.vue'
import SensitiveValue from './SensitiveValue.vue'

describe('shared screen state components', () => {
  it('renders retryable error state', () => {
    const wrapper = mount(ResourceState, { props: { state: 'error', retryable: true } })
    expect(wrapper.text()).toContain('Something needs attention')
    expect(wrapper.get('button').text()).toBe('Retry')
  })

  it('keeps sensitive values masked by default', () => {
    const wrapper = mount(SensitiveValue, { props: { value: 'sip-secret' } })
    expect(wrapper.text()).not.toContain('sip-secret')
  })
})
