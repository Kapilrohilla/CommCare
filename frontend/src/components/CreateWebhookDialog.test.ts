import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CreateWebhookDialog from './CreateWebhookDialog.vue'

function mountDialog() {
  return mount(CreateWebhookDialog, { props: { open: true }, global: { stubs: { teleport: true } } })
}

describe('CreateWebhookDialog recording events', () => {
  it('offers the three SystemRecording trigger events', () => {
    const wrapper = mountDialog()
    const options = wrapper.findAll('#webhook-trigger option')
    const byValue = Object.fromEntries(options.map((o) => [(o.element as HTMLOptionElement).value, o.text()]))
    expect(byValue['SystemRecording.Uploaded']).toContain('Recording file uploaded and accepted')
    expect(byValue['SystemRecording.Processed']).toContain('Recording is ready to play')
    expect(byValue['SystemRecording.Failed']).toContain('Recording processing failed')
  })

  it('submits the selected recording event', async () => {
    const wrapper = mountDialog()
    await wrapper.find('#webhook-name').setValue('Rec hook')
    await wrapper.find('#webhook-endpoint').setValue('https://example.com/h')
    await wrapper.find('#webhook-trigger').setValue('SystemRecording.Processed')
    await wrapper.find('form').trigger('submit')
    const emitted = wrapper.emitted('submit')
    expect(emitted?.[0][0]).toMatchObject({ triggerEvent: 'SystemRecording.Processed' })
  })
})
