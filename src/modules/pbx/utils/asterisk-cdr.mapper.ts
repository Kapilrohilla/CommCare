import {
	CallDirection,
	CallLegStatus,
	CallStatus,
} from 'src/modules/calls/constants/call.constant';
import {
	ProcessedCallData,
	ProcessedCallEvent,
	ProcessedCallLeg,
} from 'src/modules/calls/types/processed-call.types';
import { AsteriskCdrWebhookPayload } from '../dto/asterisk-cdr.dto';

export type AmiEvent = Record<string, string>;

export interface NormalizedCdr {
	uniqueId: string;
	linkedId: string;
	source: string | null;
	destination: string | null;
	callerId: string | null;
	channel: string | null;
	destinationChannel: string | null;
	startTime: string | null;
	answerTime: string | null;
	endTime: string | null;
	duration: number;
	billableSeconds: number;
	disposition: string | null;
	amaFlags: string | null;
	userField: string | null;
}

export function asAmiEvents(
	raw: Record<string, unknown>[] | undefined,
): AmiEvent[] {
	if (!raw?.length) {
		return [];
	}

	return raw.map((entry) =>
		Object.fromEntries(
			Object.entries(entry).map(([key, value]) => [key, String(value ?? '')]),
		),
	);
}

export function normalizeCdr(event: AmiEvent): NormalizedCdr {
	return {
		uniqueId: event.Uniqueid || event.UniqueID || '',
		linkedId: event.Linkedid || event.LinkedID || '',
		source: event.Source || null,
		destination: event.Destination || null,
		callerId: event.CallerID || null,
		channel: event.Channel || null,
		destinationChannel: event.DestinationChannel || null,
		startTime: event.StartTime || null,
		answerTime: event.AnswerTime || null,
		endTime: event.EndTime || null,
		duration: Number(event.Duration || 0),
		billableSeconds: Number(event.BillableSeconds || 0),
		disposition: event.Disposition || null,
		amaFlags: event.AMAFlags || null,
		userField: event.UserField || null,
	};
}

export function parseCallerId(callerId: string | null | undefined): {
	number: string | null;
	name: string | null;
} {
	if (!callerId) {
		return { number: null, name: null };
	}

	const match = callerId.match(/^"?(.+?)"?\s*<([^>]+)>$/);
	if (match) {
		return {
			name: match[1].replace(/"/g, '').trim() || null,
			number: match[2].trim() || null,
		};
	}

	return { number: callerId.trim() || null, name: null };
}

export function parseAsteriskTime(value: string | null | undefined): Date | null {
	if (!value || value === '0') {
		return null;
	}

	const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapDispositionToCallStatus(disposition: string | null | undefined): CallStatus {
	switch ((disposition || '').toUpperCase()) {
		case 'ANSWERED':
			return CallStatus.COMPLETED;
		case 'NO ANSWER':
			return CallStatus.NO_ANSWER;
		case 'BUSY':
			return CallStatus.BUSY;
		case 'FAILED':
			return CallStatus.FAILED;
		case 'CONGESTION':
			return CallStatus.UNAVAILABLE;
		default:
			return CallStatus.FAILED;
	}
}

export function mapDispositionToLegStatus(disposition: string | null | undefined): CallLegStatus {
	switch ((disposition || '').toUpperCase()) {
		case 'ANSWERED':
			return CallLegStatus.COMPLETED;
		case 'NO ANSWER':
			return CallLegStatus.NO_ANSWER;
		case 'BUSY':
			return CallLegStatus.BUSY;
		case 'FAILED':
			return CallLegStatus.FAILED;
		case 'CONGESTION':
			return CallLegStatus.UNAVAILABLE;
		default:
			return CallLegStatus.FAILED;
	}
}

function selectPrimaryCdr(cdrs: AmiEvent[]): AmiEvent | null {
	if (!cdrs.length) {
		return null;
	}

	const linkedId = cdrs[0].Linkedid || cdrs[0].LinkedID;
	if (linkedId) {
		const masterLeg = cdrs.find(
			(cdr) => (cdr.Uniqueid || cdr.UniqueID) === linkedId,
		);
		if (masterLeg) {
			return masterLeg;
		}
	}

	return cdrs[0];
}

function deriveDirection(events: AmiEvent[], primaryCdr: AmiEvent | null): CallDirection {
	const newChannel =
		events.find((event) => event.Event === 'Newchannel') ??
		events.find((event) => event.Event === 'NewChannel');

	const context = (newChannel?.Context || primaryCdr?.UserField || '').toLowerCase();
	if (context.includes('from-trunk') || context.includes('from-pstn')) {
		return CallDirection.INBOUND;
	}

	if (context.includes('from-internal') || context.includes('internal')) {
		const destination =
			events.find((event) => event.Event === 'DialBegin')?.DestCallerIDNum ||
			primaryCdr?.Destination ||
			'';

		if (/^\+?\d{7,}$/.test(destination.replace(/\D/g, ''))) {
			return CallDirection.OUTBOUND;
		}

		return CallDirection.INTERNAL;
	}

	const channel = (primaryCdr?.Channel || newChannel?.Channel || '').toLowerCase();
	if (channel.includes('trunk') || channel.includes('pstn')) {
		return CallDirection.INBOUND;
	}

	return CallDirection.INTERNAL;
}

function findHangup(events: AmiEvent[], uniqueId: string): AmiEvent | undefined {
	return events.find(
		(event) =>
			event.Event === 'Hangup' &&
			(event.Uniqueid || event.UniqueID) === uniqueId,
	);
}

function findDialEnd(events: AmiEvent[], uniqueId: string): AmiEvent | undefined {
	return events.find(
		(event) =>
			event.Event === 'DialEnd' &&
			((event.DestUniqueid || event.DestUniqueID) === uniqueId ||
				(event.Uniqueid || event.UniqueID) === uniqueId),
	);
}

function findBridgeEnter(events: AmiEvent[], uniqueId: string): AmiEvent | undefined {
	return events.find(
		(event) =>
			event.Event === 'BridgeEnter' &&
			(event.Uniqueid || event.UniqueID) === uniqueId,
	);
}

function minDate(dates: Array<Date | null>): Date | null {
	const valid = dates.filter((date): date is Date => date instanceof Date);
	if (!valid.length) {
		return null;
	}

	return new Date(Math.min(...valid.map((date) => date.getTime())));
}

function maxDate(dates: Array<Date | null>): Date | null {
	const valid = dates.filter((date): date is Date => date instanceof Date);
	if (!valid.length) {
		return null;
	}

	return new Date(Math.max(...valid.map((date) => date.getTime())));
}

function buildLeg(
	cdr: AmiEvent,
	events: AmiEvent[],
	linkedId: string,
): ProcessedCallLeg {
	const normalized = normalizeCdr(cdr);
	const uniqueId = normalized.uniqueId;
	const hangup = findHangup(events, uniqueId);
	const dialEnd = findDialEnd(events, uniqueId);
	const bridgeEnter = findBridgeEnter(events, uniqueId);
	const caller = parseCallerId(normalized.callerId);

	return {
		uniqueId,
		linkedId,
		channel: normalized.channel || uniqueId,
		destinationChannel: normalized.destinationChannel,
		callerNumber: caller.number || normalized.source,
		callerName: caller.name,
		destinationNumber: normalized.destination,
		destinationName: null,
		status: mapDispositionToLegStatus(normalized.disposition),
		startedAt: parseAsteriskTime(normalized.startTime),
		answeredAt: parseAsteriskTime(normalized.answerTime),
		endedAt: parseAsteriskTime(normalized.endTime),
		duration: normalized.duration,
		billableSeconds: normalized.billableSeconds,
		hangupCause: hangup?.Cause ? Number(hangup.Cause) : null,
		hangupCauseText: hangup?.['Cause-txt'] || hangup?.CauseTxt || null,
		dialStatus: dialEnd?.DialStatus || null,
		bridgeUniqueId:
			bridgeEnter?.BridgeUniqueid ||
			bridgeEnter?.BridgeUniqueID ||
			null,
		raw: cdr,
	};
}

function buildEvents(
	events: AmiEvent[],
	linkedId: string,
	fallbackReceivedAt: string,
): ProcessedCallEvent[] {
	return events
		.filter((event) => Boolean(event.Event))
		.map((event) => ({
			linkedId: event.Linkedid || event.LinkedID || linkedId,
			uniqueId: event.Uniqueid || event.UniqueID || null,
			eventType: event.Event,
			eventTime:
				parseAsteriskTime(event.Timestamp) ||
				parseAsteriskTime((event as Record<string, string>).receivedAt) ||
				parseAsteriskTime(fallbackReceivedAt) ||
				new Date(),
			channel: event.Channel || null,
			bridgeUniqueId:
				event.BridgeUniqueid || event.BridgeUniqueID || null,
			payload: event,
		}));
}

export function buildProcessedCall(
	payload: AsteriskCdrWebhookPayload,
): ProcessedCallData | null {
	const linkedId =
		(typeof payload.call?.linkedId === 'string' && payload.call.linkedId) ||
		null;

	if (!linkedId) {
		return null;
	}

	const cdrEvents = asAmiEvents(payload.cdrs).filter(
		(event) => event.Event === 'Cdr' || event.Uniqueid || event.UniqueID,
	);
	const amiEvents = asAmiEvents(payload.events);

	if (!cdrEvents.length) {
		return null;
	}

	const primaryCdr = selectPrimaryCdr(cdrEvents);
	if (!primaryCdr) {
		return null;
	}

	const primary = normalizeCdr(primaryCdr);
	const caller = parseCallerId(primary.callerId);
	const direction = deriveDirection(amiEvents, primaryCdr);
	const legs = cdrEvents.map((cdr) => buildLeg(cdr, amiEvents, linkedId));

	return {
		linkedId,
		direction,
		status: mapDispositionToCallStatus(primary.disposition),
		from: caller.number || primary.source,
		fromName: caller.name,
		to: primary.destination,
		toName: null,
		startedAt: minDate(legs.map((leg) => leg.startedAt)),
		answeredAt: maxDate(
			legs
				.filter((leg) => leg.billableSeconds > 0)
				.map((leg) => leg.answeredAt),
		),
		endedAt: maxDate(legs.map((leg) => leg.endedAt)),
		duration: Math.max(...legs.map((leg) => leg.duration), 0),
		billableSeconds: Math.max(...legs.map((leg) => leg.billableSeconds), 0),
		source: primary.source,
		destination: primary.destination,
		context:
			amiEvents.find((event) => event.Event === 'Newchannel')?.Context ||
			null,
		legs,
		events: buildEvents(amiEvents, linkedId, payload.receivedAt),
	};
}
