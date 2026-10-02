const WAV_HEADER_SIZE = 44;
const BITS_PER_SAMPLE = 16;

/** Wraps raw little-endian 16-bit PCM in a canonical 44-byte WAV header. */
export function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1): Buffer {
	const blockAlign = channels * (BITS_PER_SAMPLE / 8);
	const header = Buffer.alloc(WAV_HEADER_SIZE);

	header.write('RIFF', 0, 'ascii');
	header.writeUInt32LE(36 + pcm.length, 4);
	header.write('WAVE', 8, 'ascii');
	header.write('fmt ', 12, 'ascii');
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(channels, 22);
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(sampleRate * blockAlign, 28);
	header.writeUInt16LE(blockAlign, 32);
	header.writeUInt16LE(BITS_PER_SAMPLE, 34);
	header.write('data', 36, 'ascii');
	header.writeUInt32LE(pcm.length, 40);

	return Buffer.concat([header, pcm]);
}
