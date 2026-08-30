import { SystemRecordingSourceType } from '../constants/system-recording.constant';

export interface ProcessedAudioResult {
	storageKey: string;
	mimeType: string;
	format: string;
	codec?: string;
	sampleRate?: number;
	channels?: number;
	duration?: number;
	fileSize?: number;
}

export interface SystemRecordingJobPayload {
	systemRecordingId: string;
	tenantId: string;
}

export interface SystemRecordingUploadProcessPayload
	extends SystemRecordingJobPayload {
	sourceStorageKey: string;
}

export interface SystemRecordingTtsProcessPayload
	extends SystemRecordingJobPayload {
	ttsText: string;
	ttsLanguage?: string | null;
	ttsVoice?: string | null;
}
