import { WebhookRegistryEventTrigger } from '../constants/webhook.constant';
import { CreateWebhookRegistryDto } from './webhook-registry.dto';

describe('CreateWebhookRegistryDto', () => {
	const base = {
		name: 'hook',
		endpoint: 'https://example.com/hook',
		method: 'post',
	};

	it.each([
		'SystemRecording.Uploaded',
		'SystemRecording.Processed',
		'SystemRecording.Failed',
	])('accepts %s', (triggerEvent) => {
		const result = CreateWebhookRegistryDto.safeParse({ ...base, triggerEvent });
		expect(result.success).toBe(true);
	});

	it('exposes the enum members', () => {
		expect(WebhookRegistryEventTrigger.SystemRecordingUploaded).toBe('SystemRecording.Uploaded');
		expect(WebhookRegistryEventTrigger.SystemRecordingProcessed).toBe('SystemRecording.Processed');
		expect(WebhookRegistryEventTrigger.SystemRecordingFailed).toBe('SystemRecording.Failed');
	});

	it('rejects SystemRecording.Deleted', () => {
		const result = CreateWebhookRegistryDto.safeParse({
			...base,
			triggerEvent: 'SystemRecording.Deleted',
		});
		expect(result.success).toBe(false);
	});
});
