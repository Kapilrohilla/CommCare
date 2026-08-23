/**
 * Throw this from any event handler to move the current BullMQ job
 * back to "delayed" state without consuming a retry attempt.
 *
 * The BullMQ consumer intercepts this error and calls job.moveToDelayed().
 */
export class DelayedRetryError extends Error {
	readonly delayMs: number;
  
	constructor(delayMs: number, reason?: string) {
	  super(reason ?? `Delayed retry requested (${delayMs}ms)`);
	  this.name = 'DelayedRetryError';
	  this.delayMs = delayMs;
	}
  }