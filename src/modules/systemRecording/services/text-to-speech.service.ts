import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { StorageService } from 'src/infra/storage/services/storage.service';
import {
	DefaultTtsVendorConfig,
	GLOBAL_CONFIG_KEYS,
	TTS_VENDOR,
} from 'src/modules/global/constants/global-config.constant';
import { GlobalConfigService } from 'src/modules/global/services/global-config.service';
import { SYSTEM_RECORDING_FORMAT_METADATA } from '../constants/system-recording.constant';
import { SystemRecording } from '../entity/system-recording.entity';
import { ProcessedAudioResult } from '../types/system-recording.types';
import { AwsPollyService } from './aws-polly.service';

@Injectable()
/** Generates speech audio from text and stores it in object storage. */
export class TextToSpeechService {
	private readonly logger = new Logger(TextToSpeechService.name);

	constructor(
		private readonly globalConfigService: GlobalConfigService,
		private readonly awsPollyService: AwsPollyService,
		private readonly storageService: StorageService,
	) {}

	/**
	 * Synthesize `recording.ttsText`, upload to S3, return processed audio metadata.
	 */
	async generateSpeech(recording: SystemRecording): Promise<ProcessedAudioResult> {
		if (!recording.ttsText?.trim()) {
			throw new BadRequestException('ttsText is required for TTS generation');
		}

		const vendorConfig =
			await this.globalConfigService.getKeyOrDefaultValue<DefaultTtsVendorConfig>({
				key: GLOBAL_CONFIG_KEYS.DEFAULT_TTS_VENDOR,
				default: null,
			});

		if (!vendorConfig?.vendor) {
			throw new BadRequestException('defaultTtsVendor is not configured');
		}

		if (vendorConfig.vendor === TTS_VENDOR.AWS_POLLY) {
			return this.generateWithAwsPolly(recording);
		}

		throw new BadRequestException(`Unsupported TTS vendor: ${vendorConfig.vendor}`);
	}

	private async generateWithAwsPolly(
		recording: SystemRecording,
	): Promise<ProcessedAudioResult> {
		this.logger.log(`Generating TTS via AWS Polly for recording ${recording.id}`);

		const audio = await this.awsPollyService.generateSpeech({
			text: recording.ttsText!,
			voiceId: recording.ttsVoice ?? undefined,
		});

		const storageKey = `system_recordings/${recording.tenantId}/${recording.id}/processed/audio.mp3`;
		const metadata = SYSTEM_RECORDING_FORMAT_METADATA.mp3;

		await this.storageService.putObject({
			path: storageKey,
			body: audio,
			contentType: metadata.mimeType,
		});

		return {
			storageKey,
			mimeType: metadata.mimeType,
			format: metadata.format,
			codec: metadata.codec,
			fileSize: audio.length,
		};
	}
}
