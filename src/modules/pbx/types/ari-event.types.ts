export interface AriCallEventPayload {
	partitionKey: string;
	body: Record<string, unknown>;
}

export interface RawAriEvent {
	type: string;
	application?: string;
	timestamp?: string;
	channel?: { id?: string; name?: string; state?: string };
	bridge?: { id?: string };
	peer?: { id?: string; name?: string };
	args?: string[];
}

export function resolveAriPartitionKey(event: RawAriEvent): string {
	return event.channel?.id ?? event.peer?.id ?? event.bridge?.id ?? event.type;
}
