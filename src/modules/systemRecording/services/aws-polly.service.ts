import { Injectable } from '@nestjs/common';
import { PollyClient, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';
import { env } from 'src/config/env.config';

interface GenerateSpeechInput {
	text: string;
	voiceId?: string;
}

@Injectable()
export class AwsPollyService {
	private readonly client: PollyClient;

	constructor() {
		this.client = new PollyClient({ region: env.AWS_REGION });
	}

	async generateSpeech(input: GenerateSpeechInput): Promise<Buffer> {
		const command = new SynthesizeSpeechCommand({
			Engine: 'neural',
			Text: input.text,
			VoiceId: (input.voiceId as VoiceId) ?? VoiceId.Ruth,
			OutputFormat: 'mp3',
		});

		const response = await this.client.send(command);
		const audioStream = response.AudioStream;

		if (!audioStream) {
			throw new Error('AWS Polly returned no audio stream');
		}

		const bytes = await audioStream.transformToByteArray();
		return Buffer.from(bytes);
	}
}
