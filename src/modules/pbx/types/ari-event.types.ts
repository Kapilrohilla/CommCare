export interface AriCallEventPayload {
	partitionKey: string;
	idempotencyKey: string;
	body: Record<string, unknown>;
}

export interface RawAriEvent {
	type: string;
	application?: string;
	timestamp?: string;
	channel?: { id?: string; name?: string; state?: string; caller?: { number?: string; name?: string } };
	bridge?: { id?: string };
	peer?: { id?: string; name?: string };
	args?: string[];
	cause?: number;
	cause_txt?: string;
	digit?: string;
}

export interface RawAriEventBody {
	type?: string;
	application?: string;
	timestamp?: string;
	channel?: { id?: string; name?: string; state?: string; caller?: { number?: string; name?: string } };
	bridge?: { id?: string };
	peer?: { id?: string; name?: string };
	args?: string[];
	cause?: number;
	cause_txt?: string;
	digit?: string;
}

export const ROUTING_RELEVANT_ARI_EVENT_TYPES = new Set([
	'StasisStart',
	'StasisEnd',
	'ChannelDtmfReceived',
	'ChannelStateChange',
	'ChannelDestroyed',
	'ChannelHangupRequest',
]);

export function resolveAriPartitionKey(event: RawAriEvent): string {
	return event.channel?.id ?? event.peer?.id ?? event.bridge?.id ?? event.type;
}

export function isRoutingRelevantAriEvent(event: RawAriEvent): boolean {
	return ROUTING_RELEVANT_ARI_EVENT_TYPES.has(event.type);
}
