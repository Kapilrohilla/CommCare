import { Injectable, Logger } from '@nestjs/common';
import { STASIS_WORKFLOW } from 'src/constants/stasis-app-args.constant';
import { RawAriEventBody } from 'src/modules/pbx/types/ari-event.types';

/** Stub service — register only; implementation deferred. */
@Injectable()
export class AutoAttendantCallWorkflowService {
	readonly workflow = STASIS_WORKFLOW.AUTO_ATTENDANT;
	private readonly logger = new Logger(AutoAttendantCallWorkflowService.name);

	canHandle(event: RawAriEventBody): boolean {
		return event.args?.[0] === this.workflow;
	}

	async handleEvent(
		_eventName: string,
		event: RawAriEventBody,
		_retryCount: number,
	): Promise<void> {
		this.logger.warn(
			`Auto-attendant workflow not implemented (channel=${event.channel?.id ?? 'n/a'})`,
		);
	}
}
