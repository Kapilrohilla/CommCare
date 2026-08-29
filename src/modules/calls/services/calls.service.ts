import {
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { CallsRepository } from '../repositories/calls.repository';
import { CallEntity } from '../entity/calls.entity';
import { ProcessedCallData } from '../types/processed-call.types';
import { CallEventsService } from './call-events.service';
import { CallLegsService } from './call-legs.service';
import {
	CLICK2CALL_APP_ARGS,
	CallDirection,
	CallStatus,
	CallWorkflow,
} from '../constants/call.constant';
import { AuthContext } from 'src/shared/types/auth.types';
import { AsteriskCdrWebhookPayload } from 'src/modules/pbx/dto/asterisk-cdr.dto';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { Events } from 'src/constants/event.constant';
import { AsteriskService } from 'src/modules/pbx/services/asterisk.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { AriCallEventPayload } from 'src/modules/pbx/types/ari-event.types';
import { Extension } from 'src/modules/pbx/entity/extension.entity';

interface RawAriEventBody {
	type?: string;
	timestamp?: string;
	args?: string[];
	channel?: {
		id?: string;
		name?: string;
		state?: string;
		caller?: { number?: string; name?: string };
	};
}

@Injectable()
export class CallsService {
	private readonly logger = new Logger(CallsService.name);

	constructor(
		private readonly callsRepository: CallsRepository,
		private readonly callLegsService: CallLegsService,
		private readonly callEventsService: CallEventsService,
		private readonly eventProducer: EventProducer,
		private readonly asteriskService: AsteriskService,
		private readonly extensionService: ExtensionService,
	) {}

	async getCalls(): Promise<CallEntity[]> {
		return this.callsRepository.getCalls();
	}

	async getCallById(id: string): Promise<CallEntity> {
		return this.callsRepository.getCallById(id);
	}

	async getCallByLinkedId(linkedId: string): Promise<CallEntity | null> {
		return this.callsRepository.findByLinkedId(linkedId);
	}

	async createCall(call: Partial<CallEntity>): Promise<CallEntity> {
		return this.callsRepository.createCall(call);
	}

	async updateCall(call: CallEntity): Promise<CallEntity> {
		return this.callsRepository.updateCall(call);
	}

	async deleteCall(id: string): Promise<void> {
		return this.callsRepository.deleteCall(id);
	}

	async processCdr(processedCall: ProcessedCallData): Promise<CallEntity> {
		const savedCall = await this.upsertFromProcessed(processedCall);
		const legIdByUniqueId = await this.callLegsService.upsertManyFromProcessed(
			savedCall.id,
			processedCall.legs,
		);
		const callEvents = await this.callEventsService.replaceForCall(
			savedCall.id,
			processedCall.events,
			legIdByUniqueId,
		);

		this.logger.log(
			`Processed call ${savedCall.linkedId}: ${processedCall.legs.length} legs, ${callEvents.length} events`,
		);

		return savedCall;
	}

	async upsertFromProcessed(processedCall: ProcessedCallData): Promise<CallEntity> {
		const existingCall = await this.callsRepository.findByLinkedId(
			processedCall.linkedId,
		);

		const call = existingCall ?? new CallEntity();
		call.linkedId = processedCall.linkedId;
		call.direction = processedCall.direction;
		call.callerNumber = processedCall.from;
		call.callToNumber = processedCall.to;
		call.status = processedCall.status;
		call.startedAt = processedCall.startedAt;
		call.answeredAt = processedCall.answeredAt;
		call.endedAt = processedCall.endedAt;
		call.duration = processedCall.duration;
		call.billableSeconds = processedCall.billableSeconds;
		call.source = processedCall.source;
		call.destination = processedCall.destination;
		call.context = processedCall.context;

		return existingCall
			? this.callsRepository.updateCall(call)
			: this.callsRepository.createCall(call);
	}

	async originateClick2Call(
		authContext: AuthContext,
		fromNumber: string,
		toNumber: string,
		type: 'internal' | 'external',
	): Promise<CallEntity> {
		if (!authContext.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}

		this.logger.log(
			`Originating click2call from ${fromNumber} to ${toNumber} (${type})`,
		);

		const fromExtension = await this.validateExtensionForTenant(
			fromNumber,
			authContext.tenantId,
		);

		let toExtension: Extension | null = null;
		if (type === 'internal') {
			toExtension = await this.validateExtensionForTenant(
				toNumber,
				authContext.tenantId,
			);
		}

		const call = await this.callsRepository.createCall({
			tenantId: authContext.tenantId,
			workflow: CallWorkflow.CLICK_TO_CALL,
			linkedId: null,
			callerNumber: fromNumber,
			callToNumber: toNumber,
			direction:
				type === 'internal' ? CallDirection.INTERNAL : CallDirection.OUTBOUND,
			status: CallStatus.INITIATED,
			callerUserId: authContext.userId,
			callToUserId: toExtension?.userId ?? null,
			agentId: authContext.userId,
			agentExtension: fromNumber,
			startedAt: new Date(),
		});

		const callerId =
			fromExtension.callerIdNumber ??
			fromExtension.callerIdName ??
			fromNumber;

		const appArgs = [
			CLICK2CALL_APP_ARGS.WORKFLOW,
			call.id,
			toNumber,
			type,
			CLICK2CALL_APP_ARGS.LEG_AGENT,
		];

		try {
			const channel = await this.asteriskService.originateCall(
				fromExtension.pjsipEndpoint,
				{ appArgs, callerId },
			);

			call.callerChannelId = channel.id;
			call.status = CallStatus.ORIGINATING;
			await this.callsRepository.updateCall(call);
		} catch (error) {
			this.logger.error(
				`Error originating click2call ${call.id}: ${error instanceof Error ? error.message : error}`,
			);
			call.status = CallStatus.FAILED;
			call.endedAt = new Date();
			await this.callsRepository.updateCall(call);
		}

		return call;
	}

	async consumeCdrWebhook(body: AsteriskCdrWebhookPayload) {
		const linkedId =
			typeof body.call?.linkedId === 'string' ? body.call.linkedId : 'unknown';

		this.logger.log(
			`CDR webhook received for ${linkedId}: ${body.cdrs.length} CDR events, ${body.events.length} AMI events`,
		);

		await this.eventProducer.publish(Events.cdrEvent, body);
		return { message: 'CDR event published' };
	}

	async handleAsteriskCdrEvent(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const body = payload as AsteriskCdrWebhookPayload;
		const linkedId =
			typeof body.call?.linkedId === 'string' ? body.call.linkedId : 'unknown';

		this.logger.log(
			`Handling ${eventName} for ${linkedId} (retry ${retryCount}): ${body.cdrs.length} CDR events, ${body.events.length} AMI events`,
		);
	}

	async handleEventAriCallEvent(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const data = payload as AriCallEventPayload;
		const event = data.body as RawAriEventBody;
		const eventType = event.type;

		if (!eventType) {
			this.logger.warn(`Skipping ${eventName} (retry ${retryCount}): missing event type`);
			return;
		}

		this.logger.log(`Handling ARI ${eventType} (retry ${retryCount})`);

		switch (eventType) {
			case 'StasisStart':
				await this.handleClick2CallStasisStart(event);
				break;
			case 'ChannelStateChange':
				await this.handleClick2CallChannelStateChange(event);
				break;
			case 'ChannelDestroyed':
				await this.handleClick2CallChannelDestroyed(event);
				break;
			default:
				break;
		}
	}

	private async validateExtensionForTenant(
		extensionNumber: string,
		tenantId: string,
	): Promise<Extension> {
		const extension =
			await this.extensionService.getExtensionByNumber(extensionNumber);

		if (!extension) {
			throw new NotFoundException(`Extension not found: ${extensionNumber}`);
		}

		if (extension.tenantId !== tenantId) {
			throw new ForbiddenException(
				`Extension ${extensionNumber} does not belong to your tenant`,
			);
		}

		return extension;
	}

	private parseClick2CallArgs(args: string[] | undefined): {
		callId: string;
		toNumber: string;
		type: 'internal' | 'external';
		leg: string;
	} | null {
		if (!args?.length || args[0] !== CLICK2CALL_APP_ARGS.WORKFLOW) {
			return null;
		}

		const [, callId, toNumber, type, leg] = args;
		if (!callId || !toNumber || !leg) {
			return null;
		}

		return {
			callId,
			toNumber,
			type: type === 'external' ? 'external' : 'internal',
			leg,
		};
	}

	private async loadClick2Call(callId: string): Promise<CallEntity | null> {
		const call = await this.callsRepository.findById(callId);
		if (!call || call.workflow !== CallWorkflow.CLICK_TO_CALL) {
			return null;
		}
		return call;
	}

	private async handleClick2CallStasisStart(event: RawAriEventBody): Promise<void> {
		const parsed = this.parseClick2CallArgs(event.args);
		const channelId = event.channel?.id;

		if (!parsed || !channelId) {
			return;
		}

		const call = await this.loadClick2Call(parsed.callId);
		if (!call) {
			return;
		}

		if (parsed.leg === CLICK2CALL_APP_ARGS.LEG_AGENT) {
			if (call.callerChannelId && call.callerChannelId !== channelId) {
				return;
			}

			call.callerChannelId = channelId;
			call.status = CallStatus.RINGING;
			if (!call.startedAt) {
				call.startedAt = new Date();
			}
			await this.callsRepository.updateCall(call);
			return;
		}

		if (parsed.leg === CLICK2CALL_APP_ARGS.LEG_CALLEE) {
			if (call.calleeChannelId && call.calleeChannelId !== channelId) {
				return;
			}

			call.calleeChannelId = channelId;
			call.status = CallStatus.RINGING;
			await this.callsRepository.updateCall(call);
		}
	}

	private async handleClick2CallChannelStateChange(
		event: RawAriEventBody,
	): Promise<void> {
		const channelId = event.channel?.id;
		const channelState = event.channel?.state;

		if (!channelId || channelState !== 'Up') {
			return;
		}

		const call = await this.findClick2CallByChannel(channelId);
		if (!call) {
			return;
		}

		if (channelId === call.callerChannelId && !call.calleeChannelId) {
			await this.originateCalleeLeg(call);
			return;
		}

		if (channelId === call.calleeChannelId && !call.bridgeId) {
			await this.bridgeClick2CallLegs(call);
		}
	}

	private async handleClick2CallChannelDestroyed(
		event: RawAriEventBody,
	): Promise<void> {
		const channelId = event.channel?.id;
		if (!channelId) {
			return;
		}

		const call = await this.findClick2CallByChannel(channelId);
		if (!call || call.endedAt) {
			return;
		}

		const otherChannelId =
			channelId === call.callerChannelId
				? call.calleeChannelId
				: call.callerChannelId;

		if (otherChannelId) {
			try {
				await this.asteriskService.hangupChannel(otherChannelId);
			} catch (error) {
				this.logger.warn(
					`Failed to hang up peer channel ${otherChannelId} for call ${call.id}: ${error instanceof Error ? error.message : error}`,
				);
			}
		}

		const wasAnswered = Boolean(call.answeredAt);
		call.status = wasAnswered ? CallStatus.COMPLETED : CallStatus.CANCELLED;
		call.endedAt = new Date();
		if (call.startedAt) {
			call.duration = Math.max(
				0,
				Math.floor((call.endedAt.getTime() - call.startedAt.getTime()) / 1000),
			);
		}

		await this.callsRepository.updateCall(call);
	}

	private async findClick2CallByChannel(
		channelId: string,
	): Promise<CallEntity | null> {
		return this.callsRepository.findActiveClick2CallByChannel(channelId);
	}

	private async originateCalleeLeg(call: CallEntity): Promise<void> {
		if (!call.callToNumber || call.calleeChannelId) {
			return;
		}

		let endpoint = call.callToNumber;

		if (call.direction === CallDirection.INTERNAL) {
			const toExtension = await this.extensionService.getExtensionByNumber(
				call.callToNumber,
			);
			if (!toExtension) {
				call.status = CallStatus.FAILED;
				call.endedAt = new Date();
				await this.callsRepository.updateCall(call);
				return;
			}
			endpoint = toExtension.pjsipEndpoint;
		}

		const appArgs = [
			CLICK2CALL_APP_ARGS.WORKFLOW,
			call.id,
			call.callToNumber,
			call.direction === CallDirection.INTERNAL ? 'internal' : 'external',
			CLICK2CALL_APP_ARGS.LEG_CALLEE,
		];

		try {
			const channel = await this.asteriskService.originateCall(endpoint, {
				appArgs,
				callerId: call.callerNumber ?? undefined,
			});

			call.calleeChannelId = channel.id;
			call.status = CallStatus.RINGING;
			await this.callsRepository.updateCall(call);
		} catch (error) {
			this.logger.error(
				`Failed to originate callee leg for call ${call.id}: ${error instanceof Error ? error.message : error}`,
			);
			call.status = CallStatus.FAILED;
			call.endedAt = new Date();
			await this.callsRepository.updateCall(call);

			if (call.callerChannelId) {
				try {
					await this.asteriskService.hangupChannel(call.callerChannelId);
				} catch {
					// ignore hangup errors during cleanup
				}
			}
		}
	}

	private async bridgeClick2CallLegs(call: CallEntity): Promise<void> {
		if (!call.callerChannelId || !call.calleeChannelId || call.bridgeId) {
			return;
		}

		try {
			const bridge = await this.asteriskService.createBridge();
			await this.asteriskService.addChannelToBridge(
				bridge.id,
				call.callerChannelId,
			);
			await this.asteriskService.addChannelToBridge(
				bridge.id,
				call.calleeChannelId,
			);

			call.bridgeId = bridge.id;
			call.status = CallStatus.ANSWERED;
			call.answeredAt = new Date();
			await this.callsRepository.updateCall(call);
		} catch (error) {
			this.logger.error(
				`Failed to bridge call ${call.id}: ${error instanceof Error ? error.message : error}`,
			);
			call.status = CallStatus.FAILED;
			call.endedAt = new Date();
			await this.callsRepository.updateCall(call);
		}
	}
}
