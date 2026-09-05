import { Injectable, Logger } from '@nestjs/common';
import { Events } from 'src/constants/event.constant';
import {
	CLICK2CALL_APP_ARGS,
	STASIS_WORKFLOW,
} from 'src/constants/stasis-app-args.constant';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { AsteriskService } from 'src/modules/pbx/services/asterisk.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { AriChannel } from 'src/modules/pbx/types/ari-channel.types';
import { RawAriEventBody } from 'src/modules/pbx/types/ari-event.types';
import { WebhookRegistryEventTrigger } from 'src/modules/webhook/constants/webhook.constant';
import { Click2CallWebhookData } from 'src/modules/webhook/types/webhook-dispatch.types';
import {
	CallDirection,
	CallLegStatus,
	CallStatus,
	CallWorkflow,
} from '../constants/call.constant';
import { CallEntity } from '../entity/calls.entity';
import { CallLegEntity } from '../entity/call-legs.entity';
import { CallsRepository } from '../repositories/calls.repository';
import { CallEventsService } from '../services/call-events.service';
import { CallLegsService } from '../services/call-legs.service';
import { Click2CallLegRole } from '../types/click2call-leg.types';
import {
	isNoAnswerCallStatus,
	resolveCallEndStatus,
	resolveLegEndStatus,
} from '../utils/ari-hangup.util';

@Injectable()
export class Click2CallWorkflowService {
	readonly workflow = STASIS_WORKFLOW.CLICK2CALL;
	private readonly logger = new Logger(Click2CallWorkflowService.name);

	constructor(
		private readonly callsRepository: CallsRepository,
		private readonly callLegsService: CallLegsService,
		private readonly callEventsService: CallEventsService,
		private readonly eventProducer: EventProducer,
		private readonly asteriskService: AsteriskService,
		private readonly extensionService: ExtensionService,
	) {}

	canHandle(event: RawAriEventBody): boolean {
		return event.args?.[0] === this.workflow;
	}

	async handleEvent(
		_eventName: string,
		event: RawAriEventBody,
		_retryCount: number,
	): Promise<void> {
		const eventType = event.type;
		if (!eventType) {
			return;
		}

		switch (eventType) {
			case 'StasisStart':
				await this.handleStasisStart(event);
				break;
			case 'ChannelStateChange':
				await this.handleChannelStateChange(event);
				break;
			case 'ChannelDestroyed':
				await this.handleChannelDestroyed(event);
				break;
			default:
				break;
		}
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

		// New: [workflow, tenantId, callId, toNumber, type, leg]
		// Legacy: [workflow, callId, toNumber, type, leg]
		const offset = args.length >= 6 ? 2 : 1;
		const callId = args[offset];
		const toNumber = args[offset + 1];
		const type = args[offset + 2];
		const leg = args[offset + 3];

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

	private parseAriEventTime(event: RawAriEventBody): Date {
		if (event.timestamp) {
			const parsed = new Date(event.timestamp);
			if (!Number.isNaN(parsed.getTime())) {
				return parsed;
			}
		}
		return new Date();
	}

	private async recordClick2CallEvent(
		callId: string,
		eventType: string,
		options: {
			eventTime?: Date;
			channelId?: string | null;
			channelName?: string | null;
			linkedId?: string | null;
			bridgeUniqueId?: string | null;
			callLegId?: string | null;
			payload?: Record<string, unknown>;
		} = {},
	): Promise<void> {
		await this.callEventsService.appendAriEvent({
			callId,
			callLegId: options.callLegId ?? null,
			eventType,
			eventTime: options.eventTime ?? new Date(),
			channelId: options.channelId ?? null,
			channelName: options.channelName ?? null,
			linkedId: options.linkedId ?? null,
			bridgeUniqueId: options.bridgeUniqueId ?? null,
			payload: options.payload ?? {},
		});
	}

	private async createClick2CallLeg(
		call: CallEntity,
		channel: AriChannel,
		legRole: Click2CallLegRole,
		callerNumber: string,
		destinationNumber: string,
		status: CallLegStatus = CallLegStatus.CREATED,
	): Promise<CallLegEntity> {
		return this.callLegsService.upsertFromAriChannel({
			callId: call.id,
			channelId: channel.id,
			channelName: channel.name,
			linkedId: call.linkedId ?? channel.id,
			legRole,
			callerNumber,
			callerName: channel.caller?.name ?? null,
			destinationNumber,
			status,
			startedAt: new Date(),
			raw: { ariState: channel.state },
		});
	}

	private mapChannelStateToLegStatus(state?: string): CallLegStatus {
		switch (state) {
			case 'Ring':
			case 'Ringing':
				return CallLegStatus.RINGING;
			case 'Up':
				return CallLegStatus.ANSWERED;
			default:
				return CallLegStatus.INITIATED;
		}
	}

	private async loadClick2Call(callId: string): Promise<CallEntity | null> {
		const call = await this.callsRepository.findById(callId);
		if (!call || call.workflow !== CallWorkflow.CLICK_TO_CALL) {
			return null;
		}
		return call;
	}

	private async handleStasisStart(event: RawAriEventBody): Promise<void> {
		const parsed = this.parseClick2CallArgs(event.args);
		const channelId = event.channel?.id;

		if (!parsed || !channelId) {
			return;
		}

		const call = await this.loadClick2Call(parsed.callId);
		if (!call) {
			return;
		}

		const eventTime = this.parseAriEventTime(event);
		const legRole: Click2CallLegRole =
			parsed.leg === CLICK2CALL_APP_ARGS.LEG_CALLEE ? 'callee' : 'agent';
		const destinationNumber =
			legRole === 'agent' ? call.callerNumber ?? parsed.toNumber : parsed.toNumber;

		const leg = await this.callLegsService.upsertFromAriChannel({
			callId: call.id,
			channelId,
			channelName: event.channel?.name ?? channelId,
			linkedId: call.linkedId ?? channelId,
			legRole,
			callerNumber: call.callerNumber,
			callerName: event.channel?.caller?.name ?? null,
			destinationNumber,
			status: CallLegStatus.RINGING,
			startedAt: eventTime,
			raw: { ariState: event.channel?.state },
		});

		await this.recordClick2CallEvent(call.id, 'StasisStart', {
			eventTime,
			channelId,
			channelName: event.channel?.name ?? null,
			callLegId: leg.id,
			payload: { ...(event as Record<string, unknown>), legRole },
		});

		if (parsed.leg === CLICK2CALL_APP_ARGS.LEG_AGENT) {
			if (call.callerChannelId && call.callerChannelId !== channelId) {
				return;
			}

			call.callerChannelId = channelId;
			call.status = CallStatus.RINGING;
			if (!call.startedAt) {
				call.startedAt = eventTime;
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

	private async handleChannelStateChange(event: RawAriEventBody): Promise<void> {
		const channelId = event.channel?.id;
		const channelState = event.channel?.state;

		if (!channelId || !channelState) {
			return;
		}

		const call = await this.callsRepository.findActiveClick2CallByChannel(channelId);
		if (!call) {
			return;
		}

		const eventTime = this.parseAriEventTime(event);
		const legStatus = this.mapChannelStateToLegStatus(channelState);
		const leg = await this.callLegsService.updateLegStatus(channelId, legStatus, {
			answeredAt: channelState === 'Up' ? eventTime : undefined,
		});

		await this.recordClick2CallEvent(call.id, 'ChannelStateChange', {
			eventTime,
			channelId,
			channelName: event.channel?.name ?? null,
			callLegId: leg?.id ?? null,
			payload: { ...(event as Record<string, unknown>), channelState },
		});

		if (channelState !== 'Up') {
			return;
		}

		if (channelId === call.callerChannelId && !call.calleeChannelId) {
			await this.emitClick2CallWebhook(
				call,
				WebhookRegistryEventTrigger.Click2CallCallerConnected,
				{ channelId },
			);
			await this.originateCalleeLeg(call);
			return;
		}

		if (channelId === call.calleeChannelId && !call.bridgeId) {
			await this.bridgeClick2CallLegs(call);
		}
	}

	private async handleChannelDestroyed(event: RawAriEventBody): Promise<void> {
		const channelId = event.channel?.id;
		if (!channelId) {
			return;
		}

		const call = await this.callsRepository.findClick2CallForChannel(channelId);
		if (!call) {
			return;
		}

		const isCallerLeg = channelId === call.callerChannelId;
		const isCalleeLeg = channelId === call.calleeChannelId;
		if (!isCallerLeg && !isCalleeLeg) {
			return;
		}

		const eventTime = this.parseAriEventTime(event);
		const hangupCause = typeof event.cause === 'number' ? event.cause : null;
		const hangupCauseText =
			typeof event.cause_txt === 'string' ? event.cause_txt : null;
		const callAlreadyEnded = Boolean(call.endedAt);
		const wasBridged = Boolean(call.bridgeId);

		const existingLeg = await this.callLegsService.getLegByUniqueId(channelId);
		const legWasAnswered = Boolean(existingLeg?.answeredAt);

		const legStatus = resolveLegEndStatus({
			legWasAnswered,
			wasBridged,
			hangupCause,
		});

		const leg = await this.callLegsService.finalizeLegEnd(
			channelId,
			legStatus,
			eventTime,
			hangupCause,
			hangupCauseText,
		);

		await this.recordClick2CallEvent(call.id, 'ChannelDestroyed', {
			eventTime,
			channelId,
			channelName: event.channel?.name ?? null,
			callLegId: leg?.id ?? null,
			payload: {
				...(event as Record<string, unknown>),
				legStatus,
				legRole: isCallerLeg ? 'agent' : 'callee',
			},
		});

		if (callAlreadyEnded) {
			return;
		}

		const callStatus = resolveCallEndStatus({
			isCallerLeg,
			isCalleeLeg,
			legWasAnswered,
			wasBridged,
			hangupCause,
		});

		const legRole: Click2CallLegRole = isCallerLeg ? 'agent' : 'callee';
		const webhookExtra = {
			channelId,
			legRole,
			hangupCause,
			hangupCauseText,
			occurredAt: eventTime.toISOString(),
		};

		if (isNoAnswerCallStatus(callStatus)) {
			await this.emitClick2CallWebhook(
				call,
				isCallerLeg
					? WebhookRegistryEventTrigger.Click2CallCallerNoAnswer
					: WebhookRegistryEventTrigger.Click2CallCalleeNoAnswer,
				{ ...webhookExtra, status: callStatus },
			);
		} else {
			const disconnectTrigger = isCallerLeg
				? WebhookRegistryEventTrigger.Click2CallCallerDisconnected
				: WebhookRegistryEventTrigger.Click2CallCalleeDisconnected;

			await this.emitClick2CallWebhook(call, disconnectTrigger, {
				...webhookExtra,
				status: callStatus,
			});
		}

		const otherChannelId = isCallerLeg
			? call.calleeChannelId
			: call.callerChannelId;

		if (otherChannelId && !wasBridged) {
			try {
				await this.asteriskService.hangupChannel(otherChannelId);
			} catch (error) {
				this.logger.warn(
					`Failed to hang up peer channel ${otherChannelId} for call ${call.id}: ${error instanceof Error ? error.message : error}`,
				);
			}
		}

		call.status = callStatus;
		call.endedAt = eventTime;
		if (call.startedAt) {
			call.duration = Math.max(
				0,
				Math.floor((call.endedAt.getTime() - call.startedAt.getTime()) / 1000),
			);
		}

		await this.callsRepository.updateCall(call);

		this.logger.log(
			`Click2call ${call.id} ended: status=${callStatus} leg=${legRole} cause=${hangupCause ?? 'n/a'}`,
		);
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
		} else {
			endpoint = this.asteriskService.buildOutboundEndpoint(call.callToNumber);
		}

		const appArgs = [
			CLICK2CALL_APP_ARGS.WORKFLOW,
			call.tenantId ?? '',
			call.id,
			call.callToNumber,
			call.direction === CallDirection.INTERNAL ? 'internal' : 'external',
			CLICK2CALL_APP_ARGS.LEG_CALLEE,
		];

		try {
			const channel = await this.asteriskService.originateCall(endpoint, {
				appArgs,
				callerIdNumber: call.callerNumber ?? undefined,
			});

			call.calleeChannelId = channel.id;
			call.status = CallStatus.RINGING;
			await this.callsRepository.updateCall(call);

			await this.createClick2CallLeg(
				call,
				channel,
				'callee',
				call.callerNumber ?? '',
				call.callToNumber ?? '',
				CallLegStatus.CREATED,
			);
			await this.recordClick2CallEvent(call.id, 'OriginateCallee', {
				channelId: channel.id,
				channelName: channel.name,
				payload: { legRole: 'callee', state: channel.state },
			});
		} catch (error) {
			this.logger.error(
				`Failed to originate callee leg for call ${call.id}: ${error instanceof Error ? error.message : error}`,
			);
			call.status = CallStatus.FAILED;
			call.endedAt = new Date();
			await this.callsRepository.updateCall(call);
			await this.recordClick2CallEvent(call.id, 'OriginateCalleeFailed', {
				payload: {
					message: error instanceof Error ? error.message : String(error),
					toNumber: call.callToNumber,
				},
			});

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

			const bridgedAt = new Date();
			if (call.callerChannelId) {
				await this.callLegsService.upsertFromAriChannel({
					callId: call.id,
					channelId: call.callerChannelId,
					legRole: 'agent',
					status: CallLegStatus.CONNECTED,
					bridgeUniqueId: bridge.id,
					answeredAt: bridgedAt,
				});
			}
			if (call.calleeChannelId) {
				await this.callLegsService.upsertFromAriChannel({
					callId: call.id,
					channelId: call.calleeChannelId,
					legRole: 'callee',
					status: CallLegStatus.CONNECTED,
					bridgeUniqueId: bridge.id,
					answeredAt: bridgedAt,
				});
			}

			await this.recordClick2CallEvent(call.id, 'BridgeCreated', {
				bridgeUniqueId: bridge.id,
				payload: {
					bridgeId: bridge.id,
					callerChannelId: call.callerChannelId,
					calleeChannelId: call.calleeChannelId,
				},
			});

			await this.emitClick2CallWebhook(
				call,
				WebhookRegistryEventTrigger.Click2CallCalleeConnected,
				{
					bridgeId: bridge.id,
					channelId: call.calleeChannelId,
				},
			);
		} catch (error) {
			this.logger.error(
				`Failed to bridge call ${call.id}: ${error instanceof Error ? error.message : error}`,
			);
			call.status = CallStatus.FAILED;
			call.endedAt = new Date();
			await this.callsRepository.updateCall(call);
			await this.recordClick2CallEvent(call.id, 'BridgeFailed', {
				payload: {
					message: error instanceof Error ? error.message : String(error),
				},
			});
		}
	}

	private buildClick2CallWebhookData(
		call: CallEntity,
		extra: Partial<Click2CallWebhookData> = {},
	): Click2CallWebhookData {
		return {
			callId: call.id,
			callerNumber: call.callerNumber,
			callToNumber: call.callToNumber,
			status: extra.status ?? call.status,
			direction: call.direction,
			workflow: call.workflow,
			channelId: extra.channelId ?? null,
			bridgeId: extra.bridgeId ?? call.bridgeId,
			legRole: extra.legRole ?? null,
			hangupCause: extra.hangupCause ?? null,
			hangupCauseText: extra.hangupCauseText ?? null,
			occurredAt: extra.occurredAt ?? new Date().toISOString(),
		};
	}

	private async emitClick2CallWebhook(
		call: CallEntity,
		eventTrigger: WebhookRegistryEventTrigger,
		extra: Partial<Click2CallWebhookData> = {},
	): Promise<void> {
		if (!call.tenantId) {
			return;
		}

		const data = this.buildClick2CallWebhookData(call, extra);

		await this.eventProducer.publish(
			Events.webhookFanout,
			{
				eventTrigger,
				tenantId: call.tenantId,
				data,
			},
			{
				partitionKey: call.id,
			},
		);

		this.logger.log(
			`Enqueued webhook fanout ${eventTrigger} for call ${call.id}`,
		);
	}
}
