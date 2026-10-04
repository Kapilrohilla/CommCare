import { SystemRecording } from 'src/modules/systemRecording/entity/system-recording.entity';
import { buildSystemRecordingWebhookData } from './system-recording-webhook-data.util';

function makeRecording(overrides: Partial<SystemRecording> = {}): SystemRecording {
	return Object.assign(new SystemRecording(), {
		id: 'rec-1',
		name: 'Greeting',
		tenantId: 'tenant-1',
		sourceType: 'upload',
		storageKey: 'tenant-1/rec-1.wav',
		mimeType: 'audio/wav',
		format: 'wav',
		duration: 12,
		status: 'active',
		errorMessage: null,
		...overrides,
	}) as SystemRecording;
}

describe('buildSystemRecordingWebhookData', () => {
	it('returns exactly the allowed keys', () => {
		const data = buildSystemRecordingWebhookData(makeRecording());
		expect(Object.keys(data).sort()).toEqual(
			[
				'recordingId',
				'name',
				'sourceType',
				'status',
				'format',
				'duration',
				'errorMessage',
				'occurredAt',
			].sort(),
		);
		expect(data).not.toHaveProperty('storageKey');
		expect(data).not.toHaveProperty('tenantId');
		expect(JSON.stringify(data)).not.toMatch(/https?:\/\//);
	});

	it('maps values and null errorMessage', () => {
		const at = new Date('2026-01-02T03:04:05.000Z');
		const data = buildSystemRecordingWebhookData(makeRecording(), at);
		expect(data).toEqual({
			recordingId: 'rec-1',
			name: 'Greeting',
			sourceType: 'upload',
			status: 'active',
			format: 'wav',
			duration: 12,
			errorMessage: null,
			occurredAt: '2026-01-02T03:04:05.000Z',
		});
	});

	it('maps undefined optional fields to null and keeps error text', () => {
		const data = buildSystemRecordingWebhookData(
			makeRecording({
				sourceType: undefined,
				format: undefined,
				duration: undefined,
				errorMessage: 'boom',
				status: 'failed',
			} as unknown as Partial<SystemRecording>),
		);
		expect(data.sourceType).toBeNull();
		expect(data.format).toBeNull();
		expect(data.duration).toBeNull();
		expect(data.errorMessage).toBe('boom');
		expect(typeof data.occurredAt).toBe('string');
	});
});
