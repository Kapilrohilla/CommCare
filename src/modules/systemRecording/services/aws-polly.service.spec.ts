const send = jest.fn();
const clientCtor = jest.fn();

jest.mock('@aws-sdk/client-polly', () => ({
	PollyClient: jest.fn().mockImplementation((config: unknown) => {
		clientCtor(config);
		return { send };
	}),
	SynthesizeSpeechCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
	VoiceId: { Ruth: 'Ruth' },
}));
jest.mock('src/config/env.config', () => ({ env: { AWS_REGION: 'us-east-1' } }));

import { AWS_POLLY_SAMPLE_RATE, AwsPollyService } from './aws-polly.service';

const pcmStream = (bytes: number[]) => ({
	AudioStream: { transformToByteArray: async () => Uint8Array.from(bytes) },
});

describe('AwsPollyService', () => {
	let service: AwsPollyService;

	beforeEach(() => {
		jest.clearAllMocks();
		send.mockResolvedValue(pcmStream([1, 0, 2, 0]));
		service = new AwsPollyService();
	});

	it('creates the client with SDK retries enabled', () => {
		expect(clientCtor).toHaveBeenCalledWith({ region: 'us-east-1', maxAttempts: 3 });
	});

	it('requests 8kHz neural PCM with default voice Ruth and returns a WAV', async () => {
		const wav = await service.generateSpeech({ text: 'hello' });

		const input = send.mock.calls[0][0].input;
		expect(input).toEqual({
			Engine: 'neural',
			Text: 'hello',
			VoiceId: 'Ruth',
			OutputFormat: 'pcm',
			SampleRate: String(AWS_POLLY_SAMPLE_RATE),
		});
		expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
		expect(wav.readUInt32LE(24)).toBe(8000);
		expect(wav.length).toBe(44 + 4);
	});

	it('passes a Polly-shaped languageCode and a chosen voice', async () => {
		await service.generateSpeech({ text: 'hi', voiceId: 'Kajal', languageCode: 'hi-IN' });

		const input = send.mock.calls[0][0].input;
		expect(input.VoiceId).toBe('Kajal');
		expect(input.LanguageCode).toBe('hi-IN');
	});

	it.each(['en', 'EN_us', 'english', ''])('ignores non Polly-shaped languageCode %p', async (languageCode) => {
		await service.generateSpeech({ text: 'hi', languageCode });

		expect(send.mock.calls[0][0].input).not.toHaveProperty('LanguageCode');
	});

	it('throws when Polly returns no audio stream', async () => {
		send.mockResolvedValue({});

		await expect(service.generateSpeech({ text: 'hi' })).rejects.toThrow('AWS Polly returned no audio stream');
	});
});
