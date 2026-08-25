import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { RedisService } from 'src/infra/redis/services/redis.service';
import { RedlockService } from 'src/infra/redis/services/redlock.service';
import { Extension } from '../entity/extension.entity';
import { ExtensionRepository } from '../repositories/extension.repository';
import { FreePbxService } from './freepbx.service';

@Injectable()
export class ExtensionService {
	private readonly redisCacheNamespace = 'Extension';
	private readonly topExtensionRedisKey = 'topExtensionId';

	constructor(
		private readonly extensionRepository: ExtensionRepository,
		private readonly redisService: RedisService,
		private readonly logger: Logger,
		private readonly freePbxService: FreePbxService,
		private readonly redlockService: RedlockService,
	) {}

	private async getNextExtensionId(): Promise<number> {
		const cachedTopId = await this.redisService.getKey<string>(this.redisCacheNamespace, this.topExtensionRedisKey);
		if (cachedTopId !== null) {
			this.logger.log(`Cache hit for ${this.redisCacheNamespace}:${this.topExtensionRedisKey}`);
			return this.redisService.incrementKey(this.redisCacheNamespace, this.topExtensionRedisKey);
		}

		this.logger.log(`Acquiring lock for ${this.redisCacheNamespace}:${this.topExtensionRedisKey}`);
		const lock = await this.redlockService.acquireLock(this.redisCacheNamespace, this.topExtensionRedisKey, 60);
		if (!lock) {
			throw new InternalServerErrorException('Failed to acquire lock for extension id allocation');
		}

		try {
			const recheck = await this.redisService.getKey<string>(this.redisCacheNamespace, this.topExtensionRedisKey);
			if (recheck !== null) {
				return this.redisService.incrementKey(this.redisCacheNamespace, this.topExtensionRedisKey);
			}

			const maxExtensionId = await this.extensionRepository.getMaxExtensionId();
			const nextExtensionId = maxExtensionId + 1;
			await this.redisService.setKey(
				this.redisCacheNamespace,
				this.topExtensionRedisKey,
				String(nextExtensionId),
			);
			return nextExtensionId;
		} catch (error) {
			this.logger.error(`Error allocating extension id: ${error}`);
			throw new InternalServerErrorException('Error allocating extension id');
		} finally {
			await this.redlockService.releaseLock(this.redisCacheNamespace, this.topExtensionRedisKey, lock);
		}
	}

	async createExtension(extension: Extension): Promise<Extension> {
		const newExtensionId = await this.getNextExtensionId();
		const extensionNumber = newExtensionId.toString();

		await this.freePbxService.createExtension({
			extension: extensionNumber,
			name: extension.callerIdName ?? extension.description ?? extensionNumber,
			secret: extension.pjsipPassword,
		});

		return this.extensionRepository.createExtension({
			...extension,
			extension: extensionNumber,
			pjsipUsername: extension.pjsipUsername || extensionNumber,
			pjsipEndpoint: extension.pjsipEndpoint || extensionNumber,
		});
	}

	async getExtension(id: string): Promise<Extension | null> {
		return this.extensionRepository.getExtension(id);
	}

	async updateExtension(id: string, extension: Partial<Extension>): Promise<Extension> {
		const existing = await this.extensionRepository.getExtension(id);
		if (!existing) {
			throw new NotFoundException('Extension not found');
		}

		const updatedExtension = { ...existing, ...extension };

		await this.freePbxService.updateExtension(existing.extension, {
			name: updatedExtension.callerIdName ?? updatedExtension.description ?? existing.extension,
			...(updatedExtension.pjsipPassword !== undefined && { secret: updatedExtension.pjsipPassword }),
		});

		return this.extensionRepository.updateExtension(updatedExtension);
	}

	async deleteExtension(id: string): Promise<void> {
		const existing = await this.extensionRepository.getExtension(id);
		if (!existing) {
			throw new NotFoundException('Extension not found');
		}

		await this.freePbxService.deleteExtension(existing.extension);
		await this.extensionRepository.deleteExtension(id);
	}

	async getExtensionsByTenantId(tenantId: string): Promise<Extension[]> {
		return this.extensionRepository.getExtensionsByTenantId(tenantId);
	}
}
