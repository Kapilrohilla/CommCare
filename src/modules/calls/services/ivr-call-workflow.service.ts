import { Injectable, Logger } from '@nestjs/common';
import { STASIS_WORKFLOW, buildIvrAppArgs } from 'src/constants/stasis-app-args.constant';
import { AsteriskService } from 'src/modules/pbx/services/asterisk.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { RawAriEventBody } from 'src/modules/pbx/types/ari-event.types';
import { IVROptionDestinationType } from 'src/modules/ivr/constants/ivr-options.constant';
import { IVRSessionState } from 'src/modules/ivr/constants/ivr-session.constant';
import { IVROptionEntity } from 'src/modules/ivr/entity/ivr-options.entity';
import { IVRSessionEntity } from 'src/modules/ivr/entity/ivr-session.entity';
import { IVRService } from 'src/modules/ivr/services/ivr.service';
import { SystemRecordingService } from 'src/modules/systemRecording/services/system-recording.service';

@Injectable()
export class IvrCallWorkflowService {
	readonly workflow = STASIS_WORKFLOW.IVR;
	private readonly logger = new Logger(IvrCallWorkflowService.name);
	private readonly sessionsByChannel = new Map<string, IVRSessionEntity>();

	constructor(
		private readonly ivrService: IVRService,
		private readonly systemRecordingService: SystemRecordingService,
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
			case 'ChannelDtmfReceived':
				await this.handleDtmf(event);
				break;
			case 'ChannelDestroyed':
				this.sessionsByChannel.delete(event.channel?.id ?? '');
				break;
			default:
				break;
		}
	}

	private parseIvrArgs(args: string[] | undefined): {
		tenantId: string;
		ivrSessionId: string;
		ivrId: string;
	} | null {
		if (!args?.length || args[0] !== STASIS_WORKFLOW.IVR) {
			return null;
		}

		const [, tenantId, ivrSessionId, ivrId] = args;
		if (!tenantId || !ivrId) {
			return null;
		}

		return { tenantId, ivrSessionId: ivrSessionId ?? '', ivrId };
	}

	private async handleStasisStart(event: RawAriEventBody): Promise<void> {
		const channelId = event.channel?.id;
		const parsed = this.parseIvrArgs(event.args);

		if (!channelId || !parsed) {
			return;
		}

		const ivr = await this.ivrService.getIvrForCallWorkflow(
			parsed.tenantId,
			parsed.ivrId,
		);
		if (!ivr) {
			this.logger.warn(`IVR ${parsed.ivrId} not found for tenant ${parsed.tenantId}`);
			await this.asteriskService.hangupChannel(channelId);
			return;
		}

		let session: IVRSessionEntity;
		if (parsed.ivrSessionId) {
			const existing = await this.ivrService.getSessionForCallWorkflow(
				parsed.ivrSessionId,
				parsed.tenantId,
			);
			session =
				existing ??
				(await this.ivrService.createSessionForCall(
					parsed.tenantId,
					parsed.ivrId,
					channelId,
				));
		} else {
			session = await this.ivrService.createSessionForCall(
				parsed.tenantId,
				parsed.ivrId,
				channelId,
			);
		}

		this.sessionsByChannel.set(channelId, session);

		await this.asteriskService.answerChannel(channelId);

		if (ivr.announcementRecordingId) {
			const playbackUrl = await this.systemRecordingService.getTelephonyPlaybackUrl(
				parsed.tenantId,
				ivr.announcementRecordingId,
			);

			if (playbackUrl) {
				await this.asteriskService.playMedia(channelId, `sound:${playbackUrl}`);
			} else {
				this.logger.warn(
					`No playback URL for IVR ${ivr.id} announcement ${ivr.announcementRecordingId}`,
				);
			}
		}

		session.state = IVRSessionState.PLAYING_ANNOUNCEMENT;
		await this.ivrService.updateSessionForCall(session);
	}

	private async handleDtmf(event: RawAriEventBody): Promise<void> {
		const channelId = event.channel?.id;
		const digit = event.digit;

		if (!channelId || !digit) {
			return;
		}

		const parsed = this.parseIvrArgs(event.args);
		const session = this.sessionsByChannel.get(channelId);

		if (!parsed || !session) {
			return;
		}

		session.lastDigit = digit;
		session.state = IVRSessionState.PROCESSING_INPUT;
		await this.ivrService.updateSessionForCall(session);

		const option = await this.ivrService.getOptionByDigitForCallWorkflow(
			parsed.ivrId,
			digit,
		);

		if (!option) {
			session.invalidAttempts += 1;
			await this.ivrService.updateSessionForCall(session);
			return;
		}

		await this.executeDestination(
			channelId,
			parsed.tenantId,
			parsed.ivrId,
			option,
			event.channel?.caller?.number,
		);
	}

	private async executeDestination(
		channelId: string,
		tenantId: string,
		currentIvrId: string,
		option: IVROptionEntity,
		callerNumber?: string,
	): Promise<void> {
		switch (option.destinationType) {
			case IVROptionDestinationType.HANGUP:
				await this.asteriskService.hangupChannel(channelId);
				return;
			case IVROptionDestinationType.EXTENSION: {
				const extensions = await this.extensionService.getExtensionsByTenantId(tenantId);
				const extension = extensions.find((item) => item.id === option.destinationId);
				if (!extension) {
					await this.asteriskService.hangupChannel(channelId);
					return;
				}

				const callee = await this.asteriskService.originateCall(
					extension.pjsipEndpoint,
					{ callerIdNumber: callerNumber },
				);
				const bridge = await this.asteriskService.createBridge();
				await this.asteriskService.addChannelToBridge(bridge.id, channelId);
				await this.asteriskService.addChannelToBridge(bridge.id, callee.id);
				return;
			}
			case IVROptionDestinationType.IVR: {
				if (!option.destinationId) {
					await this.asteriskService.hangupChannel(channelId);
					return;
				}
				const nestedSession = await this.ivrService.createSessionForCall(
					tenantId,
					option.destinationId,
					channelId,
				);
				const appArgs = buildIvrAppArgs({
					tenantId,
					ivrSessionId: nestedSession.id,
					ivrId: option.destinationId,
				});
				this.logger.log(
					`IVR nested route ${currentIvrId} → ${option.destinationId} args=${appArgs.join(',')}`,
				);
				await this.handleStasisStart({
					type: 'StasisStart',
					channel: { id: channelId },
					args: appArgs,
				});
				return;
			}
			case IVROptionDestinationType.PHONE_NUMBER: {
				if (!option.destinationValue) {
					await this.asteriskService.hangupChannel(channelId);
					return;
				}
				const outbound = this.asteriskService.buildOutboundEndpoint(
					option.destinationValue,
				);
				const callee = await this.asteriskService.originateCall(outbound, {
					callerIdNumber: callerNumber,
				});
				const bridge = await this.asteriskService.createBridge();
				await this.asteriskService.addChannelToBridge(bridge.id, channelId);
				await this.asteriskService.addChannelToBridge(bridge.id, callee.id);
				return;
			}
			default:
				this.logger.warn(
					`Unsupported IVR destination ${option.destinationType} on IVR ${currentIvrId}`,
				);
				await this.asteriskService.hangupChannel(channelId);
		}
	}
}
