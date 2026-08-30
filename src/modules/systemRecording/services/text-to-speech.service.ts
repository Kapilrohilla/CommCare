import { Injectable, Logger } from '@nestjs/common';
import { SystemRecording } from '../entity/system-recording.entity';
import { ProcessedAudioResult } from '../types/system-recording.types';

@Injectable()
/** Generates speech audio from text and stores it in object storage. */
export class TextToSpeechService {
	private readonly logger = new Logger(TextToSpeechService.name);

	/**
	 * Synthesize `recording.ttsText`, upload to S3, return processed audio metadata.
	 * TODO: integrate TTS provider (Polly, Google TTS, etc.).
	 */
	async generateSpeech(recording: SystemRecording): Promise<ProcessedAudioResult> {
		this.logger.warn(`generateSpeech not implemented for ${recording.id}`);
		throw new Error('TTS_NOT_IMPLEMENTED');
	}
}
