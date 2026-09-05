import { Injectable, Logger } from '@nestjs/common';
import { STASIS_WORKFLOW, buildIvrAppArgs } from 'src/constants/stasis-app-args.constant';
import { AsteriskService } from 'src/modules/pbx/services/asterisk.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { RawAriEventBody } from 'src/modules/pbx/types/ari-event.types';
import { InboundRouteDestinationType } from 'src/modules/routing/constants/inbound-routes.constant';
import { InboundRoute } from 'src/modules/routing/entity/inbound-route.entity';
import { InboundRoutesService } from 'src/modules/routing/services/inbound-routes.service';
import { IvrCallWorkflowService } from './ivr-call-workflow.service';

@Injectable()
export class InboundRouteCallWorkflowService {
	readonly workflow = STASIS_WORKFLOW.INBOUND_ROUTE;
	private readonly logger = new Logger(InboundRouteCallWorkflowService.name);

	constructor(
		private readonly inboundRoutesService: InboundRoutesService,
		private readonly asteriskService: AsteriskService,
		private readonly extensionService: ExtensionService,
		private readonly ivrCallWorkflowService: IvrCallWorkflowService,
	) {}

	canHandle(event: RawAriEventBody): boolean {
		return event.args?.[0] === this.workflow;
	}

	async handleEvent(
		_eventName: string,
		event: RawAriEventBody,
		_retryCount: number,
	): Promise<void> {
		if (event.type !== 'StasisStart') {
			return;
		}

		await this.handleStasisStart(event);
	}

	private parseInboundArgs(args: string[] | undefined): {
		did: string;
		callerNumber: string;
	} | null {
		if (!args?.length || args[0] !== STASIS_WORKFLOW.INBOUND_ROUTE) {
			return null;
		}

		// [inbound-route, tenantId, did, callerNumber]
		const did = args[2] ?? args[1];
		const callerNumber = args[3] ?? args[1];

		if (!did) {
			return null;
		}

		return { did, callerNumber: callerNumber ?? 'unknown' };
	}

	private async handleStasisStart(event: RawAriEventBody): Promise<void> {
		const channelId = event.channel?.id;
		const parsed = this.parseInboundArgs(event.args);

		if (!channelId || !parsed) {
			return;
		}

		const route = await this.inboundRoutesService.findEnabledRouteByDid(parsed.did);
		if (!route) {
			this.logger.warn(`No inbound route for DID ${parsed.did}`);
			await this.asteriskService.hangupChannel(channelId);
			return;
		}

		this.logger.log(
			`Inbound route ${route.id} matched DID ${parsed.did} caller=${parsed.callerNumber}`,
		);

		if (route.destinationType !== InboundRouteDestinationType.IVR) {
			await this.asteriskService.answerChannel(channelId);
		}

		await this.executeDestination(channelId, route, parsed.callerNumber, event);
	}

	private async executeDestination(
		channelId: string,
		route: InboundRoute,
		callerNumber: string,
		event: RawAriEventBody,
	): Promise<void> {
		switch (route.destinationType) {
			case InboundRouteDestinationType.Hangup:
				await this.asteriskService.hangupChannel(channelId);
				return;
			case InboundRouteDestinationType.Extension: {
				const extensions = await this.extensionService.getExtensionsByTenantId(
					route.tenantId,
				);
				const extension = extensions.find((item) => item.id === route.destinationId);
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
			case InboundRouteDestinationType.IVR: {
				if (!route.destinationId) {
					await this.asteriskService.hangupChannel(channelId);
					return;
				}

				const appArgs = buildIvrAppArgs({
					tenantId: route.tenantId,
					ivrSessionId: channelId,
					ivrId: route.destinationId,
				});

				await this.ivrCallWorkflowService.handleEvent('StasisStart', {
					type: 'StasisStart',
					channel: event.channel ?? { id: channelId },
					args: appArgs,
				}, 0);
				return;
			}
			case InboundRouteDestinationType.ExternalNumber: {
				const number = route.destinationValue;
				if (!number) {
					await this.asteriskService.hangupChannel(channelId);
					return;
				}

				const outbound = this.asteriskService.buildOutboundEndpoint(number);
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
					`Unsupported inbound destination ${route.destinationType} on route ${route.id}`,
				);
				await this.asteriskService.hangupChannel(channelId);
		}
	}
}
