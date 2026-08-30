import { CallLegStatus, CallStatus } from '../constants/call.constant';

/** Common Asterisk Q.850 hangup causes relevant to click2call. */
export const ASTERISK_HANGUP_CAUSE = {
	NORMAL_CLEARING: 16,
	USER_BUSY: 17,
	NO_USER_RESPONSE: 18,
	NO_ANSWER: 19,
	CALL_REJECTED: 21,
	RECOVERY_ON_TIMER_EXPIRE: 102,
} as const;

export interface LegEndContext {
	legWasAnswered: boolean;
	wasBridged: boolean;
	hangupCause: number | null;
}

export interface CallEndContext extends LegEndContext {
	isCallerLeg: boolean;
	isCalleeLeg: boolean;
}

export function isNoAnswerHangupCause(cause: number | null): boolean {
	if (cause === null) {
		return false;
	}

	return (
		cause === ASTERISK_HANGUP_CAUSE.NO_ANSWER ||
		cause === ASTERISK_HANGUP_CAUSE.NO_USER_RESPONSE ||
		cause === ASTERISK_HANGUP_CAUSE.RECOVERY_ON_TIMER_EXPIRE
	);
}

export function resolveLegEndStatus(context: LegEndContext): CallLegStatus {
	const { legWasAnswered, wasBridged, hangupCause } = context;

	if (wasBridged && legWasAnswered) {
		return CallLegStatus.COMPLETED;
	}

	if (hangupCause === ASTERISK_HANGUP_CAUSE.USER_BUSY) {
		return CallLegStatus.BUSY;
	}

	if (hangupCause === ASTERISK_HANGUP_CAUSE.CALL_REJECTED) {
		return CallLegStatus.CANCELLED;
	}

	if (isNoAnswerHangupCause(hangupCause) || !legWasAnswered) {
		return CallLegStatus.NO_ANSWER;
	}

	if (legWasAnswered) {
		return CallLegStatus.CANCELLED;
	}

	return CallLegStatus.CANCELLED;
}

export function resolveCallEndStatus(context: CallEndContext): CallStatus {
	const { isCallerLeg, isCalleeLeg, legWasAnswered, wasBridged, hangupCause } =
		context;

	if (wasBridged) {
		return CallStatus.COMPLETED;
	}

	if (hangupCause === ASTERISK_HANGUP_CAUSE.USER_BUSY) {
		return CallStatus.BUSY;
	}

	if (hangupCause === ASTERISK_HANGUP_CAUSE.CALL_REJECTED) {
		return CallStatus.REJECTED;
	}

	if (isCallerLeg && !legWasAnswered) {
		return CallStatus.NO_ANSWER;
	}

	if (isCalleeLeg && !legWasAnswered) {
		return CallStatus.NO_ANSWER;
	}

	if (isNoAnswerHangupCause(hangupCause)) {
		return CallStatus.NO_ANSWER;
	}

	if (legWasAnswered) {
		return CallStatus.CANCELLED;
	}

	return CallStatus.CANCELLED;
}

export function isNoAnswerCallStatus(status: CallStatus): boolean {
	return status === CallStatus.NO_ANSWER;
}
