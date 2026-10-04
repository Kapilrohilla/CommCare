import { SystemRecording } from 'src/modules/systemRecording/entity/system-recording.entity';
import { SystemRecordingWebhookData } from '../types/webhook-dispatch.types';

/**
 * Builds the webhook payload for a system recording event.
 * Explicit field mapping so internals (storageKey, URLs, tenantId) can never leak.
 */
export function buildSystemRecordingWebhookData(
	recording: SystemRecording,
	occurredAt: Date = new Date(),
): SystemRecordingWebhookData {
	return {
		recordingId: recording.id,
		name: recording.name,
		sourceType: recording.sourceType ?? null,
		status: recording.status,
		format: recording.format ?? null,
		duration: recording.duration ?? null,
		errorMessage: recording.errorMessage ?? null,
		occurredAt: occurredAt.toISOString(),
	};
}
