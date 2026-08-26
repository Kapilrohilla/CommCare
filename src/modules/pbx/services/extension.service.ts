import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Events } from 'src/constants/event.constant';
import { env } from 'src/config/env.config';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { RedisService } from 'src/infra/redis/services/redis.service';
import { RedlockService } from 'src/infra/redis/services/redlock.service';
import {
	DEFAULT_ASTERISK_PORT,
	ExtensionStatus,
	ExtensionTransport,
	ExtensionType,
} from '../constants/extension.constant';
import {
	BulkCreateExtensionDto,
	CreateExtensionInput,
	ExtensionCreateEventPayload,
} from '../dto/extension.dto';
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
		private readonly eventProducer: EventProducer,
	) {}

	private generatePjsipPassword(): string {
		return randomBytes(16).toString('base64url');
	}

	private buildExtensionEntity(input: CreateExtensionInput, extensionNumber: string): Extension {
		const extension = new Extension();
		extension.tenantId = input.tenantId;
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

	async createExtension(input: CreateExtensionInput): Promise<Extension> {
		const newExtensionId = await this.getNextExtensionId();
		const extensionNumber = newExtensionId.toString();
		const extension = this.buildExtensionEntity(input, extensionNumber);

		await this.freePbxService.createExtension({
			extension: extensionNumber,
			name: extension.callerIdName ?? extension.description ?? extensionNumber,
			secret: extension.pjsipPassword,
		});

		return this.extensionRepository.createExtension(extension);
	}

	async queueBulkExtensionCreate(
		dto: BulkCreateExtensionDto,
		tenantId: string,
	): Promise<{ batchId: string; count: number }> {
		const batchId = randomUUID();

		for (let index = 0; index < dto.count; index++) {
			await this.eventProducer.publish(Events.extensionCreate, {
				batchId,
				index,
				tenantId,
				description: dto.description,
				callerIdName: dto.callerIdName,
				type: dto.type,
				status: dto.status,
			});
		}

		return { batchId, count: dto.count };
	}

	async handleEventExtensionCreate(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const data = payload as ExtensionCreateEventPayload;

		this.logger.log(
			`Handling ${eventName} for batch ${data.batchId} index ${data.index} (retry ${retryCount})`,
		);

		await this.createExtension({
			tenantId: data.tenantId,
			description: data.description,
			callerIdName: data.callerIdName,
			type: data.type,
			status: data.status,
		});
	}

	async getExtension(id: string): Promise<Extension | null> {
		return this.extensionRepository.getExtension(id);
	}

	async getExtensions(): Promise<Extension[]> {
		return this.extensionRepository.getExtensions();
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
