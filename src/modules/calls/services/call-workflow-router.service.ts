import { Injectable, Logger } from '@nestjs/common';
import { STASIS_WORKFLOW } from 'src/constants/stasis-app-args.constant';
import { RedisService } from 'src/infra/redis/services/redis.service';
import { AriCallEventPayload, RawAriEventBody } from 'src/modules/pbx/types/ari-event.types';
import { AsteriskService } from 'src/modules/pbx/services/asterisk.service';
import { Click2CallWorkflowService } from './click2call-workflow.service';
import { InboundRouteCallWorkflowService } from './inbound-route-call-workflow.service';
import { IvrCallWorkflowService } from './ivr-call-workflow.service';
import { AutoAttendantCallWorkflowService } from './auto-attendant-call-workflow.service';

const IDEMPOTENCY_NAMESPACE = 'AriEventIdempotency';
const IDEMPOTENCY_TTL_SECONDS = 300;

interface WorkflowService {
	readonly workflow: string;
	canHandle(event: RawAriEventBody): boolean;
	handleEvent(eventName: string, event: RawAriEventBody, retryCount: number): Promise<void>;
}

@Injectable()
export class CallWorkflowRouterService {
	private readonly logger = new Logger(CallWorkflowRouterService.name);
	private readonly workflowServices: WorkflowService[];

	constructor(
		private readonly redisService: RedisService,
		private readonly asteriskService: AsteriskService,
		click2CallWorkflowService: Click2CallWorkflowService,
		ivrCallWorkflowService: IvrCallWorkflowService,
		inboundRouteCallWorkflowService: InboundRouteCallWorkflowService,
		autoAttendantCallWorkflowService: AutoAttendantCallWorkflowService,
	) {
		this.workflowServices = [
			click2CallWorkflowService,
			ivrCallWorkflowService,
			inboundRouteCallWorkflowService,
			autoAttendantCallWorkflowService,
		];
	}

	async handleEventAriCallEvent(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const data = payload as AriCallEventPayload & { idempotencyKey?: string };
		const event = data.body as RawAriEventBody;
		const eventType = event.type;

		if (!eventType) {
			this.logger.warn(`Skipping ${eventName} (retry ${retryCount}): missing event type`);
			return;
		}

		if (data.idempotencyKey) {
			const seen = await this.redisService.getKey<string>(
				IDEMPOTENCY_NAMESPACE,
				data.idempotencyKey,
			);
			if (seen) {
				this.logger.debug(`Skipping duplicate ARI event ${data.idempotencyKey}`);
				return;
			}
			await this.redisService.setKey(
				IDEMPOTENCY_NAMESPACE,
				data.idempotencyKey,
				'1',
				IDEMPOTENCY_TTL_SECONDS,
			);
		}

		this.logger.log(`Routing ARI ${eventType} (retry ${retryCount})`);

		const workflowService = this.workflowServices.find((candidate) =>
			candidate.canHandle(event),
		);
		if (!workflowService) {
			const workflow = event.args?.[0] ?? 'unknown';
			this.logger.error(`No workflow service for appArg workflow=${workflow} type=${eventType}`);
			const channelId = event.channel?.id;
			if (channelId && eventType === 'StasisStart') {
				try {
					await this.asteriskService.hangupChannel(channelId);
				} catch (error) {
					this.logger.warn(
						`Failed to hang up unhandled Stasis channel ${channelId}: ${error instanceof Error ? error.message : error}`,
					);
				}
			}
			return;
		}

		await workflowService.handleEvent(eventName, event, retryCount);
	}
}

export { STASIS_WORKFLOW };
