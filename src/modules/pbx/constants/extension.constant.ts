export enum ExtensionType {
	USER = 'user',

	// will add these later on when we have the other types

	// SYSTEM = 'system', 
	// QUEUE = 'queue',
	// IVR = 'ivr',
	// CONFERENCE = 'conference',
}

export enum ExtensionStatus {
	AVAILABLE = 'available',
	RESERVED = 'reserved',
	ASSIGNED = 'assigned',
	DISABLED = 'disabled',
}

export enum ExtensionTransport {
	UDP = 'udp',
	TCP = 'tcp',
	TLS = 'tls',
	WS = 'ws',
	WSS = 'wss',
}

export const BASE_EXTENSION_ID = 3000;