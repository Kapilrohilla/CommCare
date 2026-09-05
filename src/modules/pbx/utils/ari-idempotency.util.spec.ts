import { buildAriEventIdempotencyKey } from './ari-idempotency.util';

describe('buildAriEventIdempotencyKey', () => {
	it('returns stable key for same event payload', () => {
		const event = {
			type: 'StasisStart',
			timestamp: '2026-01-01T00:00:00.000Z',
			channel: { id: 'chan-1' },
		};

		const a = buildAriEventIdempotencyKey(event);
		const b = buildAriEventIdempotencyKey(event);
		expect(a).toBe(b);
		expect(a).toHaveLength(32);
	});

	it('returns different keys for different channel ids', () => {
		const base = {
			type: 'ChannelStateChange',
			timestamp: '2026-01-01T00:00:00.000Z',
		};

		const a = buildAriEventIdempotencyKey({
			...base,
			channel: { id: 'chan-1' },
		});
		const b = buildAriEventIdempotencyKey({
			...base,
			channel: { id: 'chan-2' },
		});

		expect(a).not.toBe(b);
	});
});
