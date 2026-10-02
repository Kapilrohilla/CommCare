import { BadRequestException } from '@nestjs/common';
import { TTS_VENDOR } from 'src/modules/global/constants/global-config.constant';
import { SystemRecording } from '../entity/system-recording.entity';
import { pcmToWav } from '../utils/pcm-to-wav.util';
import { TextToSpeechService } from './text-to-speech.service';

jest.mock('src/config/env.config', () => ({ env: { AWS_REGION: 'us-east-1' } }));

describe('TextToSpeechService', () => {
	const recording = {
		id: 'rec-1',
		tenantId: 'tenant-1',
		ttsText: 'Welcome',
		ttsVoice: 'Joanna',
		ttsLanguage: 'en-US',
	} as SystemRecording;

	function build(vendor: string | null = TTS_VENDOR.AWS_POLLY, wav?: Buffer) {
		const globalConfigService = {
			getKeyOrDefaultValue: jest.fn(async () => (vendor ? { vendor } : null)),
		};
		const awsPollyService = {
			generateSpeech: jest.fn(async () => wav ?? pcmToWav(Buffer.alloc(16000), 8000)),
		};
		const storageService = { putObject: jest.fn(async () => undefined) };
		const service = new TextToSpeechService(
			globalConfigService as never,
			awsPollyService as never,
			storageService as never,
		);
		return { service, awsPollyService, storageService };
	}

	it('stores a wav and returns telephony metadata', async () => {
		const { service, awsPollyService, storageService } = build();

		const result = await service.generateSpeech(recording);

		expect(awsPollyService.generateSpeech).toHaveBeenCalledWith({
			text: 'Welcome',
			voiceId: 'Joanna',
			languageCode: 'en-US',
		});
		expect(storageService.putObject).toHaveBeenCalledWith(
			expect.objectContaining({
				path: 'system_recordings/tenant-1/rec-1/processed/audio.wav',
				contentType: 'audio/wav',
			}),
		);
		expect(result).toEqual({
			storageKey: 'system_recordings/tenant-1/rec-1/processed/audio.wav',
			mimeType: 'audio/wav',
			format: 'wav',
			codec: 'pcm_s16le',
			sampleRate: 8000,
			channels: 1,
			duration: 1,
			fileSize: 44 + 16000,
		});
	});

	it('rounds duration up to whole seconds to fit the integer column', async () => {
		const { service } = build(TTS_VENDOR.AWS_POLLY, pcmToWav(Buffer.alloc(20000), 8000));

		const result = await service.generateSpeech(recording);

		expect(result.duration).toBe(2);
		expect(Number.isInteger(result.duration)).toBe(true);
	});

	it('reports duration 0 for an empty wav', async () => {
		const { service } = build(TTS_VENDOR.AWS_POLLY, pcmToWav(Buffer.alloc(0), 8000));

		const result = await service.generateSpeech(recording);

		expect(result.duration).toBe(0);
	});

	it('passes undefined voice and language when the recording has none', async () => {
		const { service, awsPollyService } = build();

		await service.generateSpeech({ ...recording, ttsVoice: null, ttsLanguage: null } as SystemRecording);

		expect(awsPollyService.generateSpeech).toHaveBeenCalledWith({
			text: 'Welcome',
			voiceId: undefined,
			languageCode: undefined,
		});
	});

	it('rejects blank text, missing vendor and unsupported vendor', async () => {
		await expect(build().service.generateSpeech({ ...recording, ttsText: '  ' } as SystemRecording)).rejects.toThrow(BadRequestException);
		await expect(build(null).service.generateSpeech(recording)).rejects.toThrow('defaultTtsVendor is not configured');
		await expect(build('other').service.generateSpeech(recording)).rejects.toThrow('Unsupported TTS vendor: other');
	});
});
