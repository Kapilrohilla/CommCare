import { CallLegStatus } from '../constants/call.constant';

export type Click2CallLegRole = 'agent' | 'callee';

export interface UpsertAriCallLegInput {
	callId: string;
	channelId: string;
	channelName?: string | null;
	linkedId?: string | null;
	legRole: Click2CallLegRole;
	callerNumber?: string | null;
	callerName?: string | null;
	destinationNumber?: string | null;
	status?: CallLegStatus;
	startedAt?: Date | null;
	answeredAt?: Date | null;
	endedAt?: Date | null;
	bridgeUniqueId?: string | null;
	raw?: Record<string, unknown> | null;
}

export interface AppendAriCallEventInput {
	callId: string;
	callLegId?: string | null;
	eventType: string;
	eventTime: Date;
	channelId?: string | null;
	channelName?: string | null;
	linkedId?: string | null;
	bridgeUniqueId?: string | null;
	payload: Record<string, unknown>;
}
