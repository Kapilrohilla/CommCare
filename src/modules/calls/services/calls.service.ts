import {
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { CallsRepository } from '../repositories/calls.repository';
import { CallEntity } from '../entity/calls.entity';
import {
	buildClick2CallAppArgs,
	CLICK2CALL_APP_ARGS,
} from '../constants/call.constant';
import {
	CallDirection,
	CallLegStatus,
	CallStatus,
	CallWorkflow,
} from '../constants/call.constant';
import { AuthContext } from 'src/shared/types/auth.types';
import { AsteriskCdrWebhookPayload } from 'src/modules/pbx/dto/asterisk-cdr.dto';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { Events } from 'src/constants/event.constant';
import { AsteriskService } from 'src/modules/pbx/services/asterisk.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { Extension } from 'src/modules/pbx/entity/extension.entity';
import { CallLegsService } from './call-legs.service';
import { CallEventsService } from './call-events.service';

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

		const callerIdName = fromExtension.callerIdName;
		const callerIdNumber = fromExtension.callerIdNumber ?? fromNumber;

		const appArgs = buildClick2CallAppArgs({
			tenantId: authContext.tenantId,
			callId: call.id,
			toNumber,
			type,
			leg: CLICK2CALL_APP_ARGS.LEG_AGENT,
		});

		try {
			const channel = await this.asteriskService.originateCall(
				fromExtension.pjsipEndpoint,
				{
					appArgs,
					callerIdName,
					callerIdNumber,
				},
			);

			call.callerChannelId = channel.id;
			call.status = CallStatus.ORIGINATING;
			await this.callsRepository.updateCall(call);

			await this.callLegsService.upsertFromAriChannel({
				callId: call.id,
				channelId: channel.id,
				channelName: channel.name,
				linkedId: call.linkedId ?? channel.id,
				legRole: 'agent',
				callerNumber: fromNumber,
				callerName: channel.caller?.name ?? null,
				destinationNumber: toNumber,
				status: CallLegStatus.CREATED,
				startedAt: new Date(),
				raw: { ariState: channel.state },
			});

			await this.callEventsService.appendAriEvent({
				callId: call.id,
				callLegId: null,
				eventType: 'Originate',
				eventTime: new Date(),
				channelId: channel.id,
				channelName: channel.name,
				linkedId: null,
				bridgeUniqueId: null,
				payload: { legRole: 'agent', state: channel.state },
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(
				`Error originating click2call ${call.id}: ${message}. ` +
					'If Asterisk returned "Allocation failed", verify the agent extension is registered ' +
					'(softphone online) and the PJSIP endpoint exists.',
			);
			call.status = CallStatus.FAILED;
			call.endedAt = new Date();
			await this.callsRepository.updateCall(call);
			await this.callEventsService.appendAriEvent({
				callId: call.id,
				callLegId: null,
				eventType: 'OriginateFailed',
				eventTime: new Date(),
				channelId: null,
				channelName: null,
				linkedId: null,
				bridgeUniqueId: null,
				payload: { message, fromNumber, toNumber, type },
			});
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

	public async startOrEndDialerSession(
		authContext: AuthContext,
		startOrEnd: 'start' | 'end',
		extensionId: string,
	): Promise<void> {
		if (!authContext.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}

		await this.validateExtensionForTenant(extensionId, authContext.tenantId);

		if (startOrEnd === 'start') {
			return this.startDialerSession(authContext, extensionId);
		}

		return this.endDialerSession(authContext, extensionId);
	}

	private async startDialerSession(
		_authContext: AuthContext,
		_extensionId: string,
	): Promise<void> {
		// trigger call to this extension
	}

	private async endDialerSession(
		_authContext: AuthContext,
		_extensionId: string,
	): Promise<void> {
		// hangup the session call if it exists
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
}
