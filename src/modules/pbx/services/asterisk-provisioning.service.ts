import { Injectable, Logger } from '@nestjs/common';
import { Extension } from '../entity/extension.entity';
import { ExtensionRepository } from '../repositories/extension.repository';
import { PjsipRealtimeRepository } from '../repositories/pjsip-realtime.repository';

@Injectable()
export class AsteriskProvisioningService {
	private readonly logger = new Logger(AsteriskProvisioningService.name);

	constructor(
		private readonly pjsipRealtimeRepository: PjsipRealtimeRepository,
		private readonly extensionRepository: ExtensionRepository,
	) {}

	async provisionExtension(extension: Extension): Promise<void> {
		await this.pjsipRealtimeRepository.upsertExtension(extension);
		this.logger.log(`Provisioned PJSIP realtime rows for extension ${extension.extension}`);
	}

	async updateExtension(extension: Extension): Promise<void> {
		await this.provisionExtension(extension);
	}

	async deleteExtension(extensionNumber: string): Promise<void> {
		await this.pjsipRealtimeRepository.deleteExtension(extensionNumber);
		this.logger.log(`Removed PJSIP realtime rows for extension ${extensionNumber}`);
	}

	async syncAllExtensions(): Promise<{ synced: number; errors: number }> {
		const extensions = await this.extensionRepository.getExtensions();
		let synced = 0;
		let errors = 0;

		for (const extension of extensions) {
			try {
				await this.provisionExtension(extension);
				synced += 1;
			} catch (error) {
				errors += 1;
				this.logger.error(
					`Failed to sync extension ${extension.extension}: ${error instanceof Error ? error.message : error}`,
				);
			}
		}

		this.logger.log(`Bulk sync complete: ${synced} synced, ${errors} errors`);
		return { synced, errors };
	}
}
