import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Events } from 'src/constants/event.constant';
import { env } from 'src/config/env.config';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { RedisService } from 'src/infra/redis/services/redis.service';
import { RedlockService } from 'src/infra/redis/services/redlock.service';
import {
	DEFAULT_ASTERISK_PORT,
	EXTENSION_REPLENISH_BATCH_SIZE,
	ExtensionStatus,
	ExtensionTransport,
	ExtensionType,
	MIN_AVAILABLE_EXTENSION_THRESHOLD,
} from '../constants/extension.constant';
import { CreateExtensionInput, ExtensionCreateEventPayload } from '../dto/extension.dto';
import { Extension, UserInfo } from '../entity/extension.entity';
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
		private readonly eventProducer: EventProducer,
	) {}

	private generatePjsipPassword(): string {
		// FreePBX requires alphanumeric secrets with both letters and numbers.
		return randomBytes(12).toString('hex');
	}

	private buildExtensionEntity(input: CreateExtensionInput, extensionNumber: string): Extension {
		const extension = new Extension();
		extension.tenantId = input.tenantId ?? null;
		extension.userId = null;
		extension.userInfo = null;
		extension.extension = extensionNumber;
		extension.description = input.description ?? null;
		extension.type = input.type ?? ExtensionType.USER;
		extension.status = input.status ?? ExtensionStatus.AVAILABLE;
		extension.asteriskHost = env.ARI_HOST;
		extension.asteriskPort = DEFAULT_ASTERISK_PORT;
		extension.asteriskTransport = ExtensionTransport.UDP;
		extension.pjsipEndpoint = extensionNumber;
		extension.pjsipUsername = extensionNumber;
		extension.pjsipPassword = this.generatePjsipPassword();
		extension.callerIdName = input.callerIdName ?? null;
		extension.callerIdNumber = null;
		return extension;
	}

	private async getNextExtensionId(): Promise<number> {
		const cachedTopId = await this.redisService.getKey<string>(this.redisCacheNamespace, this.topExtensionRedisKey);
		if (cachedTopId !== null) {
			return this.redisService.incrementKey(this.redisCacheNamespace, this.topExtensionRedisKey);
		}

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

	async createPoolExtension(input: CreateExtensionInput = {}): Promise<Extension> {
		const newExtensionId = await this.getNextExtensionId();
		const extensionNumber = newExtensionId.toString();
		const extension = this.buildExtensionEntity(
			{ ...input, tenantId: null, status: ExtensionStatus.AVAILABLE },
			extensionNumber,
		);

		await this.freePbxService.createExtension({
			extension: extensionNumber,
			name: extension.callerIdName ?? extension.description ?? extensionNumber,
			secret: extension.pjsipPassword,
		});

		return this.extensionRepository.createExtension(extension);
	}

	async countAvailableExtensions(): Promise<number> {
		return this.extensionRepository.countAvailable();
	}

	async ensureAvailableExtensionPool(): Promise<{ batchId: string; count: number } | null> {
		const available = await this.countAvailableExtensions();
		if (available >= MIN_AVAILABLE_EXTENSION_THRESHOLD) {
			return null;
		}

		const deficit = MIN_AVAILABLE_EXTENSION_THRESHOLD - available;
		const count = Math.max(deficit, EXTENSION_REPLENISH_BATCH_SIZE);
		const batchId = randomUUID();

		for (let index = 0; index < count; index++) {
			await this.eventProducer.publish(Events.extensionCreate, { batchId, index });
		}

		this.logger.log(`Enqueued ${count} pool extension create events (available: ${available})`);
		return { batchId, count };
	}

	async handleEventExtensionCreate(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const data = payload as ExtensionCreateEventPayload;

		this.logger.log(
			`Handling ${eventName} batch ${data.batchId} index ${data.index} (retry ${retryCount})`,
		);

		await this.createPoolExtension({
			description: data.description,
			callerIdName: data.callerIdName,
			type: data.type,
		});
	}

	async assignOneAvailableToTenant(tenantId: string): Promise<Extension> {
		const extensions = await this.extensionRepository.reserveAvailableForTenant(tenantId, 1);
		if (extensions.length === 0) {
			throw new BadRequestException('No available extensions in pool');
		}

		return extensions[0];
	}

	async assignAvailableToTenant(tenantId: string, count: number): Promise<Extension[]> {
		const extensions = await this.extensionRepository.reserveAvailableForTenant(tenantId, count);
		if (extensions.length < count) {
			throw new BadRequestException(
				`Not enough available extensions. Requested ${count}, found ${extensions.length}`,
			);
		}

		return extensions;
	}

	async assignExtensionsToUser(
		tenantId: string,
		userId: string,
		extensionIds: string[],
		userInfo: UserInfo,
	): Promise<Extension[]> {
		const extensions = await this.extensionRepository.assignReservedExtensionsToUser(
			tenantId,
			userId,
			extensionIds,
			userInfo,
		);

		for (const extension of extensions) {
			await this.freePbxService.updateExtension(extension.extension, {
				name: userInfo.name,
			});
		}

		return extensions;
	}

	async unassignExtensionFromUser(tenantId: string, extensionId: string, userId: string): Promise<Extension> {
		const extension = await this.extensionRepository.getExtensionForTenant(tenantId, extensionId);
		if (!extension) {
			throw new NotFoundException('Extension not found');
		}
		if (extension.userId !== userId) {
			throw new BadRequestException('Extension is not assigned to this user');
		}

		extension.userId = null;
		extension.userInfo = null;
		extension.status = ExtensionStatus.RESERVED;
		extension.callerIdName = null;

		await this.freePbxService.updateExtension(extension.extension, {
			name: extension.extension,
		});

		return this.extensionRepository.updateExtension(extension);
	}

	async unregisterExtensionFromTenant(tenantId: string, extensionId: string): Promise<Extension> {
		const extension = await this.extensionRepository.getExtensionForTenant(tenantId, extensionId);
		if (!extension) {
			throw new NotFoundException('Extension not found');
		}
		if (extension.userId) {
			throw new BadRequestException('Unassign extension from user before unregistering from tenant');
		}

		extension.tenantId = null;
		extension.status = ExtensionStatus.AVAILABLE;

		const updated = await this.extensionRepository.updateExtension(extension);
		await this.ensureAvailableExtensionPool();
		return updated;
	}

	async syncUserInfoOnExtensions(userId: string, userInfo: UserInfo): Promise<void> {
		const extensions = await this.extensionRepository.getExtensionsByUserId(userId);
		const info: UserInfo = { name: userInfo.name, userId };
		for (const extension of extensions) {
			extension.userInfo = info;
			extension.callerIdName = info.name;
			await this.freePbxService.updateExtension(extension.extension, { name: info.name });
			await this.extensionRepository.updateExtension(extension);
		}
	}

	async handleEventExtensionPoolMaintenance(
		eventName: string,
		_payload: unknown,
		retryCount: number,
	): Promise<void> {
		this.logger.log(`Handling ${eventName} (retry ${retryCount})`);
		await this.ensureAvailableExtensionPool();
	}

	async getExtension(id: string): Promise<Extension | null> {
		return this.extensionRepository.getExtension(id);
	}

	async getExtensionsByTenantId(tenantId: string): Promise<Extension[]> {
		return this.extensionRepository.getExtensionsByTenantId(tenantId);
	}

	async getExtensionsByUserId(userId: string): Promise<Extension[]> {
		return this.extensionRepository.getExtensionsByUserId(userId);
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
}
