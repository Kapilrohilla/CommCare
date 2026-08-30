export enum IVRSessionState {
	STARTED = 'started',
	PLAYING_ANNOUNCEMENT = 'playing_announcement',
	WAITING_FOR_INPUT = 'waiting_for_input',
	PROCESSING_INPUT = 'processing_input',
	ROUTING = 'routing',
	COMPLETED = 'completed',
	FAILED = 'failed',
}
