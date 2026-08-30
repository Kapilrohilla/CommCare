export enum SystemRecordingSourceType {
	UPLOAD = "upload",
	TTS = "tts",
}
export enum SystemRecordingStatus {
	PENDING = "pending",
	PROCESSING = "processing",
	ACTIVE = "active",
	FAILED = "failed",
}

export const SYSTEM_RECORDING_ALLOWED_EXTENSIONS = ['wav', 'mp3', 'gsm'] as const;

export type SystemRecordingAllowedExtension =
	(typeof SYSTEM_RECORDING_ALLOWED_EXTENSIONS)[number];

export const SYSTEM_RECORDING_FORMAT_METADATA: Record<
	SystemRecordingAllowedExtension,
	{ mimeType: string; format: string; codec: string }
> = {
	wav: { mimeType: 'audio/wav', format: 'wav', codec: 'pcm_s16le' },
	mp3: { mimeType: 'audio/mpeg', format: 'mp3', codec: 'mp3' },
	gsm: { mimeType: 'audio/x-gsm', format: 'gsm', codec: 'gsm' },
};