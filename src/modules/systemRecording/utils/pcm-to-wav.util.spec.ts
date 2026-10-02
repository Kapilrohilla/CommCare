import { pcmToWav } from './pcm-to-wav.util';

describe('pcmToWav', () => {
	it('prepends a valid 44-byte RIFF/WAVE header for 8kHz mono 16-bit', () => {
		const pcm = Buffer.from([1, 0, 2, 0, 3, 0, 4, 0]);
		const wav = pcmToWav(pcm, 8000);

		expect(wav.length).toBe(44 + pcm.length);
		expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
		expect(wav.readUInt32LE(4)).toBe(36 + pcm.length);
		expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
		expect(wav.toString('ascii', 12, 16)).toBe('fmt ');
		expect(wav.readUInt32LE(16)).toBe(16);
		expect(wav.readUInt16LE(20)).toBe(1); // PCM
		expect(wav.readUInt16LE(22)).toBe(1); // channels
		expect(wav.readUInt32LE(24)).toBe(8000); // sample rate
		expect(wav.readUInt32LE(28)).toBe(16000); // byte rate
		expect(wav.readUInt16LE(32)).toBe(2); // block align
		expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
		expect(wav.toString('ascii', 36, 40)).toBe('data');
		expect(wav.readUInt32LE(40)).toBe(pcm.length);
		expect(wav.subarray(44).equals(pcm)).toBe(true);
	});

	it('handles empty PCM with a valid header', () => {
		const wav = pcmToWav(Buffer.alloc(0), 8000);
		expect(wav.length).toBe(44);
		expect(wav.readUInt32LE(40)).toBe(0);
	});

	it('computes byte rate and block align for stereo', () => {
		const wav = pcmToWav(Buffer.alloc(4), 16000, 2);
		expect(wav.readUInt32LE(28)).toBe(64000);
		expect(wav.readUInt16LE(32)).toBe(4);
	});
});
