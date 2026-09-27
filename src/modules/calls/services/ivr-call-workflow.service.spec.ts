jest.mock('src/modules/pbx/services/asterisk.service', () => ({
	AsteriskService: class AsteriskService {},
}));
jest.mock('src/modules/pbx/services/extension.service', () => ({
	ExtensionService: class ExtensionService {},
}));
jest.mock('src/modules/ivr/services/ivr.service', () => ({
	IVRService: class IVRService {},
}));
jest.mock('src/modules/systemRecording/services/system-recording.service', () => ({
	SystemRecordingService: class SystemRecordingService {},
}));
jest.mock('./queue-call-workflow.service', () => ({
	QueueCallWorkflowService: class QueueCallWorkflowService {},
}));

import { IVROptionDestinationType } from 'src/modules/ivr/constants/ivr-options.constant';
import { IVRSessionState } from 'src/modules/ivr/constants/ivr-session.constant';
import { IVROptionEntity } from 'src/modules/ivr/entity/ivr-options.entity';
import { IVRSessionEntity } from 'src/modules/ivr/entity/ivr-session.entity';
import { IvrCallWorkflowService } from './ivr-call-workflow.service';

describe('IvrCallWorkflowService', () => {
	const IVR_ARGS = ['ivr', 'tenant-1', '', 'ivr-1'];

	function buildService(overrides?: {
		getTelephonyPlaybackUrl?: jest.Mock;
		handleEvent?: jest.Mock;
		option?: IVROptionEntity | null;
	}) {
		const session = Object.assign(new IVRSessionEntity(), {
			id: 'session-1',
			tenantId: 'tenant-1',
			ivrId: 'ivr-1',
			state: IVRSessionState.STARTED,
			invalidAttempts: 0,
			timeoutAttempts: 0,
			lastDigit: null,
		});
		const ivrService = {
			getIvrForCallWorkflow: jest.fn(async () => ({
				id: 'ivr-1',
				announcementRecordingId: null,
			})),
			getSessionForCallWorkflow: jest.fn(async () => null),
			createSessionForCall: jest.fn(async () => session),
			updateSessionForCall: jest.fn(async (s: unknown) => s),
			getOptionByDigitForCallWorkflow:
				overrides?.option !== undefined
					? jest.fn(async () => overrides.option)
					: jest.fn(async () => null),
		};
		const systemRecordingService = {
			getTelephonyPlaybackUrl:
				overrides?.getTelephonyPlaybackUrl ??
				jest.fn(async () => 'https://example.com/rec.wav'),
		};
		const asteriskService = {
			hangupChannel: jest.fn(async () => undefined),
			answerChannel: jest.fn(async () => undefined),
			playMedia: jest.fn(async () => undefined),
			originateCall: jest.fn(async () => ({ id: 'callee-channel' })),
			createBridge: jest.fn(async () => ({ id: 'bridge-1' })),
			addChannelToBridge: jest.fn(async () => undefined),
			buildOutboundEndpoint: jest.fn((n: string) => `PJSIP/${n}`),
		};
		const extensionService = {
			getExtensionsByTenantId: jest.fn(async () => []),
		};
		const queueCallWorkflowService = {
			handleEvent: overrides?.handleEvent ?? jest.fn(async () => undefined),
		};

		const service = new IvrCallWorkflowService(
			ivrService as never,
			systemRecordingService as never,
			asteriskService as never,
			extensionService as never,
			queueCallWorkflowService as never,
		);

		return { service, asteriskService, systemRecordingService, queueCallWorkflowService };
	}

	function buildOption(overrides: Partial<IVROptionEntity>): IVROptionEntity {
		return Object.assign(new IVROptionEntity(), {
			id: 'option-1',
			destinationType: IVROptionDestinationType.HANGUP,
			destinationId: null,
			destinationValue: null,
			...overrides,
		});
	}

	async function enterIvrThenPressDigit(
		service: IvrCallWorkflowService,
		digit: string,
	): Promise<void> {
		await service.handleEvent('StasisStart', {
			type: 'StasisStart',
			channel: { id: 'channel-1' },
			args: IVR_ARGS,
		}, 0);
		await service.handleEvent('ChannelDtmfReceived', {
			type: 'ChannelDtmfReceived',
			channel: { id: 'channel-1' },
			args: IVR_ARGS,
			digit,
		}, 0);
	}

	describe('QUEUE destination', () => {
		it('hands off to the queue call workflow with the correct appArgs', async () => {
			const option = buildOption({
				destinationType: IVROptionDestinationType.QUEUE,
				destinationId: 'queue-1',
			});
			const { service, queueCallWorkflowService } = buildService({ option });

			await enterIvrThenPressDigit(service, '1');

			expect(queueCallWorkflowService.handleEvent).toHaveBeenCalledWith(
				'StasisStart',
				expect.objectContaining({
					type: 'StasisStart',
					channel: { id: 'channel-1' },
					args: ['queue', 'tenant-1', '', 'queue-1', 'caller', ''],
				}),
				0,
			);
		});

		it('hangs up when the queue option has no destinationId', async () => {
			const option = buildOption({ destinationType: IVROptionDestinationType.QUEUE });
			const { service, asteriskService, queueCallWorkflowService } = buildService({
				option,
			});

			await enterIvrThenPressDigit(service, '1');

			expect(asteriskService.hangupChannel).toHaveBeenCalledWith('channel-1');
			expect(queueCallWorkflowService.handleEvent).not.toHaveBeenCalled();
		});
	});

	describe('ANNOUNCEMENT destination', () => {
		it('plays the recording then hangs up', async () => {
			const option = buildOption({
				destinationType: IVROptionDestinationType.ANNOUNCEMENT,
				destinationId: 'recording-1',
			});
			const { service, asteriskService, systemRecordingService } = buildService({
				option,
			});

			await enterIvrThenPressDigit(service, '2');

			expect(systemRecordingService.getTelephonyPlaybackUrl).toHaveBeenCalledWith(
				'tenant-1',
				'recording-1',
			);
			expect(asteriskService.playMedia).toHaveBeenCalledWith(
				'channel-1',
				'sound:https://example.com/rec.wav',
			);
			expect(asteriskService.hangupChannel).toHaveBeenCalledWith('channel-1');
		});

		it('hangs up without playback when no URL is available', async () => {
			const option = buildOption({
				destinationType: IVROptionDestinationType.ANNOUNCEMENT,
				destinationId: 'recording-1',
			});
			const { service, asteriskService } = buildService({
				option,
				getTelephonyPlaybackUrl: jest.fn(async () => null),
			});

			await enterIvrThenPressDigit(service, '2');

			expect(asteriskService.playMedia).not.toHaveBeenCalled();
			expect(asteriskService.hangupChannel).toHaveBeenCalledWith('channel-1');
		});
	});
});
