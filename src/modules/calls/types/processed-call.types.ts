import {
	CallDirection,
	CallLegStatus,
	CallStatus,
} from '../constants/call.constant';

export interface ProcessedCallLeg {
	uniqueId: string;
	linkedId: string;
	channel: string;
	destinationChannel: string | null;
	callerNumber: string | null;
	callerName: string | null;
	destinationNumber: string | null;
	destinationName: string | null;
	status: CallLegStatus;
	startedAt: Date | null;
	answeredAt: Date | null;
	endedAt: Date | null;
	duration: number;
	billableSeconds: number;
	hangupCause: number | null;
	hangupCauseText: string | null;
	dialStatus: string | null;
	bridgeUniqueId: string | null;
	raw: Record<string, string>;
}

export interface ProcessedCallEvent {
	linkedId: string | null;
	uniqueId: string | null;
	eventType: string;
	eventTime: Date;
	channel: string | null;
	bridgeUniqueId: string | null;
	payload: Record<string, unknown>;
}

export interface ProcessedCallData {
	linkedId: string;
	direction: CallDirection;
	status: CallStatus;
	from: string | null;
	fromName: string | null;
	to: string | null;
	toName: string | null;
	startedAt: Date | null;
	answeredAt: Date | null;
	endedAt: Date | null;
	duration: number;
	billableSeconds: number;
	source: string | null;
	destination: string | null;
	context: string | null;
	legs: ProcessedCallLeg[];
	events: ProcessedCallEvent[];
}
