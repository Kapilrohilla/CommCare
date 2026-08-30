import { Injectable, Logger } from '@nestjs/common';
import { SYSTEM_RECORDING_FORMAT_METADATA } from '../constants/system-recording.constant';
import { SystemRecording } from '../entity/system-recording.entity';
import { ProcessedAudioResult } from '../types/system-recording.types';
import { getAllowedExtensionFromFileName } from '../utils/system-recording-file.util';

@Injectable()
/** Converts user-uploaded audio to a PBX-compatible format. */
export class RecordingProcessorService {
	private readonly logger = new Logger(RecordingProcessorService.name);

	/**
	 * Validates upload format and returns metadata for supported files.
	 * TODO: transcode to 8kHz mono WAV/ulaw for Asterisk when needed.
	 */
	async processRecording(
		recording: SystemRecording,
		sourceStorageKey: string,
	): Promise<ProcessedAudioResult> {
		const fileName = sourceStorageKey.split('/').pop() ?? sourceStorageKey;
		const extension = getAllowedExtensionFromFileName(fileName);
		const metadata = SYSTEM_RECORDING_FORMAT_METADATA[extension];

		this.logger.log(
			`Accepted ${extension} upload for ${recording.id} (source=${sourceStorageKey})`,
		);

		return {
			storageKey: sourceStorageKey,
			mimeType: metadata.mimeType,
			format: metadata.format,
			codec: metadata.codec,
		};
	}
}
