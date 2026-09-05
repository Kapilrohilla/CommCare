import { createHash } from 'node:crypto';
import { RawAriEvent } from 'src/modules/pbx/types/ari-event.types';

export function buildAriEventIdempotencyKey(event: RawAriEvent): string {
	const channelId = event.channel?.id ?? event.peer?.id ?? event.bridge?.id ?? 'none';
	const timestamp = event.timestamp ?? '';
	const sequence = (event as { sequence?: number }).sequence ?? '';
	const raw = `${event.type}:${channelId}:${timestamp}:${sequence}`;
	return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}
