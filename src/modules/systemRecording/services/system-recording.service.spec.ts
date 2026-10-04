import { SystemRecordingService } from './system-recording.service';
import {
	SystemRecordingSourceType,
	SystemRecordingStatus,
} from '../constants/system-recording.constant';
import { WebhookRegistryEventTrigger } from 'src/modules/webhook/constants/webhook.constant';

// got is ESM-only; transitively imported via the webhook dispatcher
jest.mock('got', () => ({ __esModule: true, default: jest.fn() }));

describe('SystemRecordingService webhook events', () => {
	const auth = { tenantId: 'tenant-1', userId: 'user-1' } as never;
	const result = {
		storageKey: 'system_recordings/tenant-1/rec-1/processed/audio.wav',
		mimeType: 'audio/wav',
		format: 'wav',
		duration: 3,
	};

	function buildRecording(overrides: Record<string, unknown> = {}) {
		return {
			id: 'rec-1',
			tenantId: 'tenant-1',
			name: 'Greeting',
			sourceType: SystemRecordingSourceType.UPLOAD,
			status: SystemRecordingStatus.PENDING,
			storageKey: 'raw/key',
			ttsText: 'hello',
			errorMessage: null,
			...overrides,
		};
	}

	function build(recording = buildRecording()) {
		const calls: string[] = [];
		const repo = {
			getByIdAndTenantId: jest.fn(async () => recording),
			getById: jest.fn(async () => recording),
			save: jest.fn(async (r: unknown) => {
				calls.push('save');
				return r;
			}),
		};
		const storage = { exists: jest.fn(async () => ({ exists: true })) };
		const processor = { processRecording: jest.fn(async () => result) };
		const tts = { generateSpeech: jest.fn(async () => result) };
		const eventProducer = { publish: jest.fn(async () => undefined) };
		const dispatcher = {
			enqueueWebhookFanout: jest.fn(async (..._args: unknown[]) => {
				calls.push('emit');
			}),
		};
		const service = new SystemRecordingService(
			repo as never,
			storage as never,
			processor as never,
			tts as never,
			eventProducer as never,
			dispatcher as never,
		);
		return { service, recording, repo, processor, tts, dispatcher, calls };
	}

	const payload = { systemRecordingId: 'rec-1', sourceStorageKey: 'raw/key', ttsText: 'hello' };

	it('confirmUpload emits Uploaded for the tenant after save', async () => {
		const { service, dispatcher, calls } = build();
		await service.confirmUpload(auth, 'rec-1', { fileName: 'a.mp3' } as never);
		expect(dispatcher.enqueueWebhookFanout).toHaveBeenCalledTimes(1);
		const [trigger, tenantId, data] = dispatcher.enqueueWebhookFanout.mock.calls[0] as any[];
		expect(trigger).toBe(WebhookRegistryEventTrigger.SystemRecordingUploaded);
		expect(tenantId).toBe('tenant-1');
		expect(data.recordingId).toBe('rec-1');
		expect(calls.indexOf('emit')).toBeGreaterThan(calls.lastIndexOf('save'));
	});

	it('TTS generation success emits Processed once, after save', async () => {
		const { service, dispatcher, calls, recording } = build(
			buildRecording({ sourceType: SystemRecordingSourceType.TTS }),
		);
		await service.handleEventSystemRecordingGenerateTts('e', payload, 0);
		expect(dispatcher.enqueueWebhookFanout).toHaveBeenCalledTimes(1);
		const [trigger, tenantId, data] = dispatcher.enqueueWebhookFanout.mock.calls[0] as any[];
		expect(trigger).toBe(WebhookRegistryEventTrigger.SystemRecordingProcessed);
		expect(tenantId).toBe('tenant-1');
		expect(data.status).toBe(SystemRecordingStatus.ACTIVE);
		expect(recording.status).toBe(SystemRecordingStatus.ACTIVE);
		expect(calls[calls.length - 1]).toBe('emit');
		expect(calls[calls.length - 2]).toBe('save');
	});

	it('upload processing success emits Processed once', async () => {
		const { service, dispatcher } = build();
		await service.handleEventSystemRecordingProcessUpload('e', payload, 0);
		expect(dispatcher.enqueueWebhookFanout).toHaveBeenCalledTimes(1);
		expect(dispatcher.enqueueWebhookFanout.mock.calls[0][0]).toBe(
			WebhookRegistryEventTrigger.SystemRecordingProcessed,
		);
	});

	it('processing failure emits Failed with errorMessage and failed status', async () => {
		const { service, dispatcher, processor, calls } = build();
		processor.processRecording.mockRejectedValue(new Error('ffmpeg broke'));
		await service.handleEventSystemRecordingProcessUpload('e', payload, 0);
		expect(dispatcher.enqueueWebhookFanout).toHaveBeenCalledTimes(1);
		const [trigger, tenantId, data] = dispatcher.enqueueWebhookFanout.mock.calls[0] as any[];
		expect(trigger).toBe(WebhookRegistryEventTrigger.SystemRecordingFailed);
		expect(tenantId).toBe('tenant-1');
		expect(data.errorMessage).toBe('ffmpeg broke');
		expect(data.status).toBe('failed');
		expect(calls[calls.length - 1]).toBe('emit');
	});

	it('submitting a TTS recording emits no Uploaded event', async () => {
		const { service, dispatcher } = build(
			buildRecording({ sourceType: SystemRecordingSourceType.TTS }),
		);
		await service.processSystemRecording(auth, 'rec-1');
		expect(dispatcher.enqueueWebhookFanout).not.toHaveBeenCalled();
	});

	it('keeps recording active and does not throw when fanout enqueue rejects', async () => {
		const { service, dispatcher, recording } = build();
		dispatcher.enqueueWebhookFanout.mockRejectedValue(new Error('queue down'));
		await expect(
			service.handleEventSystemRecordingProcessUpload('e', payload, 0),
		).resolves.toBeUndefined();
		expect(recording.status).toBe(SystemRecordingStatus.ACTIVE);
	});

	it('keeps recording failed and does not throw when fanout enqueue rejects on failure', async () => {
		const { service, dispatcher, processor, recording } = build();
		processor.processRecording.mockRejectedValue(new Error('bad'));
		dispatcher.enqueueWebhookFanout.mockRejectedValue(new Error('queue down'));
		await expect(
			service.handleEventSystemRecordingProcessUpload('e', payload, 0),
		).resolves.toBeUndefined();
		expect(recording.status).toBe(SystemRecordingStatus.FAILED);
		expect(recording.errorMessage).toBe('bad');
	});

	it('confirmUpload still succeeds when fanout enqueue rejects', async () => {
		const { service, dispatcher } = build();
		dispatcher.enqueueWebhookFanout.mockRejectedValue(new Error('queue down'));
		await expect(
			service.confirmUpload(auth, 'rec-1', { fileName: 'a.mp3' } as never),
		).resolves.toBeDefined();
	});
});
