export enum QueueStrategy {
	RingAll = 'ring_all',
	RoundRobin = 'round_robin',
	LeastRecent = 'least_recent',
	FewestCalls = 'fewest_calls',
	Random = 'random',
}

export enum QueueCallStatus {
	Waiting = 'waiting',
	Ringing = 'ringing',
	Bridged = 'bridged',
	Completed = 'completed',
	Abandoned = 'abandoned',
	TimedOut = 'timed_out',
	Full = 'full',
}

export enum QueueCallEventType {
	EnteredQueue = 'entered_queue',
	PositionChanged = 'position_changed',
	AgentOffered = 'agent_offered',
	AgentAnswered = 'agent_answered',
	AgentRejected = 'agent_rejected',
	AgentUnavailable = 'agent_unavailable',
	CallerAbandoned = 'caller_abandoned',
	QueueTimeout = 'queue_timeout',
	QueueFull = 'queue_full',
	CallBridged = 'call_bridged',
	CallCompleted = 'call_completed',
}

export const DEFAULT_RING_TIMEOUT_SECONDS = 15;
export const DEFAULT_MAX_WAIT_TIME_SECONDS = 300;

export const MIN_RING_TIMEOUT_SECONDS = 5;
export const MAX_RING_TIMEOUT_SECONDS = 120;
export const MIN_MAX_WAIT_TIME_SECONDS = 10;
export const MAX_MAX_WAIT_TIME_SECONDS = 3600;
