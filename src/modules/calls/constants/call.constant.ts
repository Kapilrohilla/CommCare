export enum CallWorkflow {
	CLICK_TO_CALL = 'click_to_call',
}

/** Stasis appArgs passed to Asterisk for click2call correlation. */
export const CLICK2CALL_APP_ARGS = {
	WORKFLOW: 'click2call',
	LEG_AGENT: 'agent',
	LEG_CALLEE: 'callee',
} as const;

export enum CallDirection {
	/**
	 * Extension/agent → external number via trunk
	 */
	OUTBOUND = 'outbound',

	/**
	 * External number/DID → extension/agent
	 */
	INBOUND = 'inbound',

	/**
	 * Extension → extension
	 */
	INTERNAL = 'internal',
}

export enum CallStatus {
	/**
	 * Call/channel has started but hasn't rung yet.
	 */
	INITIATED = 'initiated',

	/**
	 * Call/channel is being originated.
	 */
	ORIGINATING = 'originating',

	/**
	 * Destination is being alerted.
	 */
	RINGING = 'ringing',

	/**
	 * Call was successfully answered.
	 */
	ANSWERED = 'answered',

	/**
	 * Call ended normally after being answered.
	 */
	COMPLETED = 'completed',

	/**
	 * Destination did not answer.
	 */
	NO_ANSWER = 'no_answer',

	/**
	 * Destination was busy.
	 */
	BUSY = 'busy',

	/**
	 * Call failed before being established.
	 */
	FAILED = 'failed',

	/**
	 * Caller cancelled before answer.
	 */
	CANCELLED = 'cancelled',

	/**
	 * Asterisk/trunk/channel was unavailable.
	 */
	UNAVAILABLE = 'unavailable',

	/**
	 * Call was rejected.
	 */
	REJECTED = 'rejected',
}

export enum CallLegStatus {
	/**
	 * Channel has been created.
	 */
	CREATED = 'created',

	/**
	 * Channel is trying to establish the call.
	 */
	INITIATED = 'initiated',

	/**
	 * Destination is ringing.
	 */
	RINGING = 'ringing',

	/**
	 * Leg has been answered.
	 */
	ANSWERED = 'answered',

	/**
	 * Leg is currently connected/bridged.
	 */
	CONNECTED = 'connected',

	/**
	 * Leg ended normally.
	 */
	COMPLETED = 'completed',

	/**
	 * Leg was not answered.
	 */
	NO_ANSWER = 'no_answer',

	/**
	 * Destination was busy.
	 */
	BUSY = 'busy',

	/**
	 * Leg failed.
	 */
	FAILED = 'failed',

	/**
	 * Leg was cancelled.
	 */
	CANCELLED = 'cancelled',

	/**
	 * Channel became unavailable.
	 */
	UNAVAILABLE = 'unavailable',
}