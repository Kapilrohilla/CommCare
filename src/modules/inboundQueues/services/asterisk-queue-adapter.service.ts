import { Injectable, Logger } from '@nestjs/common';
import { AsteriskService } from 'src/modules/pbx/services/asterisk.service';
import { AriChannel } from 'src/modules/pbx/types/ari-channel.types';
import { SystemRecordingService } from 'src/modules/systemRecording/services/system-recording.service';

/**
 * Translates Statsis queue business logic into Asterisk/ARI calls. Every
 * queue-specific ARI interaction goes through here so the rest of the
 * module stays free of Asterisk-specific identifiers/primitives.
 */
@Injectable()
export class AsteriskQueueAdapter {
	private readonly logger = new Logger(AsteriskQueueAdapter.name);

	constructor(
		private readonly asteriskService: AsteriskService,
		private readonly systemRecordingService: SystemRecordingService,
	) {}

	async ringMember(
		endpoint: string,
		appArgs: string[],
		callerNumber: string | null,
		ringTimeoutSeconds: number,
	): Promise<AriChannel> {
		this.logger.log(`Ringing queue member endpoint=${endpoint} timeout=${ringTimeoutSeconds}`);
		return this.asteriskService.originateCall(endpoint, {
			appArgs,
			callerIdNumber: callerNumber ?? undefined,
			timeout: ringTimeoutSeconds,
		});
	}

	async bridgeCallerAndAgent(
		callerChannelId: string,
		agentChannelId: string,
	): Promise<{ id: string }> {
		const bridge = await this.asteriskService.createBridge();
		await this.asteriskService.addChannelToBridge(bridge.id, callerChannelId);
		await this.asteriskService.addChannelToBridge(bridge.id, agentChannelId);
		return bridge;
	}

	async cancelRing(channelId: string): Promise<void> {
		try {
			await this.asteriskService.hangupChannel(channelId);
		} catch (error) {
			this.logger.warn(
				`Failed to cancel ringing channel ${channelId}: ${error instanceof Error ? error.message : error}`,
			);
		}
	}

	async resolveMusicOnHoldUrl(
		tenantId: string,
		musicOnHoldId: string | null,
	): Promise<string | null> {
		if (!musicOnHoldId) {
			return null;
		}
		return this.systemRecordingService.getTelephonyPlaybackUrl(tenantId, musicOnHoldId);
	}
}
