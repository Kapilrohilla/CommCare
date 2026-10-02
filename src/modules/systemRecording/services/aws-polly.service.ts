import { Injectable } from '@nestjs/common';
import { PollyClient, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';
import { env } from 'src/config/env.config';
import { pcmToWav } from '../utils/pcm-to-wav.util';

/** Telephony sample rate; Polly supports 8000 for pcm output on neural voices. */
export const AWS_POLLY_SAMPLE_RATE = 8000;

/** Polly LanguageCode shape, e.g. en-US, hi-IN. Anything else is not sent. */
const POLLY_LANGUAGE_CODE = /^[a-z]{2,3}-[A-Z]{2}$/;

interface GenerateSpeechInput {
	text: string;
	voiceId?: string;
	languageCode?: string;
}

@Injectable()
export class AwsPollyService {
	private readonly client: PollyClient;

	constructor() {
		this.client = new PollyClient({ region: env.AWS_REGION, maxAttempts: 3 });
	}

	/** Synthesizes speech and returns a complete 8kHz mono 16-bit WAV file. */
	async generateSpeech(input: GenerateSpeechInput): Promise<Buffer> {
		const languageCode =
			input.languageCode && POLLY_LANGUAGE_CODE.test(input.languageCode)
				? input.languageCode
				: undefined;

		const command = new SynthesizeSpeechCommand({
			Engine: 'neural',
			Text: input.text,
			VoiceId: (input.voiceId as VoiceId) ?? VoiceId.Ruth,
			OutputFormat: 'pcm',
			SampleRate: String(AWS_POLLY_SAMPLE_RATE),
			...(languageCode && { LanguageCode: languageCode as never }),
		});

		const response = await this.client.send(command);
		const audioStream = response.AudioStream;

		if (!audioStream) {
			throw new Error('AWS Polly returned no audio stream');
		}

		const pcm = Buffer.from(await audioStream.transformToByteArray());
		return pcmToWav(pcm, AWS_POLLY_SAMPLE_RATE);
	}
}
