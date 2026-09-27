import {
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
	forwardRef,
} from '@nestjs/common';
import { AuthContext } from 'src/shared/types/auth.types';
import { InboundRoutesService } from 'src/modules/routing/services/inbound-routes.service';
import { InboundRouteDestinationType } from 'src/modules/routing/constants/inbound-routes.constant';
import { QueueStrategy } from '../constants/queue.constant';
import { CreateQueueDto, UpdateQueueDto } from '../dto/queue.dto';
import { Queue } from '../entity/queue.entity';
import { QueueRepository } from '../repositories/queue.repository';

@Injectable()
export class QueuesService {
	constructor(
		private readonly queueRepository: QueueRepository,
		@Inject(forwardRef(() => InboundRoutesService))
		private readonly inboundRoutesService: InboundRoutesService,
	) {}

	async createQueue(auth: AuthContext, dto: CreateQueueDto): Promise<Queue> {
		const tenantId = this.requireTenant(auth);
		this.validateRanges(dto);
		await this.ensureUniqueName(dto.name, tenantId);

		const queue = new Queue();
		queue.tenantId = tenantId;
		queue.name = dto.name;
		queue.description = dto.description ?? null;
		queue.strategy = dto.strategy ?? QueueStrategy.RingAll;
		if (dto.ringTimeoutSeconds !== undefined) {
			queue.ringTimeoutSeconds = dto.ringTimeoutSeconds;
		}
		if (dto.maxWaitTimeSeconds !== undefined) {
			queue.maxWaitTimeSeconds = dto.maxWaitTimeSeconds;
		}
		queue.maxCallers = dto.maxCallers ?? null;
		queue.musicOnHoldId = dto.musicOnHoldId ?? null;
		queue.enabled = dto.enabled ?? true;

		return this.queueRepository.create(queue);
	}

	async getQueuesByTenant(auth: AuthContext): Promise<Queue[]> {
		return this.queueRepository.getByTenantId(this.requireTenant(auth));
	}

	async getQueueById(auth: AuthContext, id: string): Promise<Queue> {
		return this.getQueueForTenant(auth, id);
	}

	async updateQueue(
		auth: AuthContext,
		id: string,
		dto: UpdateQueueDto,
	): Promise<Queue> {
		const queue = await this.getQueueForTenant(auth, id);
		this.validateRanges(dto);

		if (dto.name !== undefined && dto.name !== queue.name) {
			await this.ensureUniqueName(dto.name, queue.tenantId, queue.id);
			queue.name = dto.name;
		}
		if (dto.description !== undefined) {
			queue.description = dto.description;
		}
		if (dto.strategy !== undefined) {
			queue.strategy = dto.strategy;
		}
		if (dto.ringTimeoutSeconds !== undefined) {
			queue.ringTimeoutSeconds = dto.ringTimeoutSeconds;
		}
		if (dto.maxWaitTimeSeconds !== undefined) {
			queue.maxWaitTimeSeconds = dto.maxWaitTimeSeconds;
		}
		if (dto.maxCallers !== undefined) {
			queue.maxCallers = dto.maxCallers;
		}
		if (dto.musicOnHoldId !== undefined) {
			queue.musicOnHoldId = dto.musicOnHoldId;
		}
		if (dto.enabled !== undefined) {
			queue.enabled = dto.enabled;
		}

		return this.queueRepository.save(queue);
	}

	async deleteQueue(auth: AuthContext, id: string): Promise<void> {
		const queue = await this.getQueueForTenant(auth, id);

		const referenced = await this.inboundRoutesService.existsRouteReferencingDestination(
			InboundRouteDestinationType.Queue,
			queue.id,
		);
		if (referenced) {
			throw new ConflictException(
				'Queue is referenced by an inbound route; reassign the route before deleting this queue',
			);
		}

		await this.queueRepository.delete(id);
	}

	/** Used by inbound-route destination validation and the call workflow. */
	async getEnabledQueueForTenant(tenantId: string, id: string): Promise<Queue> {
		const queue = await this.queueRepository.getByIdAndTenantId(id, tenantId);
		if (!queue || !queue.enabled) {
			throw new NotFoundException('Queue not found or disabled');
		}
		return queue;
	}

	async saveQueue(queue: Queue): Promise<Queue> {
		return this.queueRepository.save(queue);
	}

	private async ensureUniqueName(
		name: string,
		tenantId: string,
		excludeId?: string,
	): Promise<void> {
		const exists = await this.queueRepository.existsByNameAndTenant(
			name,
			tenantId,
			excludeId,
		);
		if (exists) {
			throw new ConflictException(`Queue with name ${name} already exists`);
		}
	}

	private async getQueueForTenant(auth: AuthContext, id: string): Promise<Queue> {
		const tenantId = this.requireTenant(auth);
		const queue = await this.queueRepository.getByIdAndTenantId(id, tenantId);
		if (!queue) {
			throw new NotFoundException('Queue not found');
		}
		return queue;
	}

	private validateRanges(dto: {
		ringTimeoutSeconds?: number;
		maxWaitTimeSeconds?: number;
	}): void {
		if (
			dto.ringTimeoutSeconds !== undefined &&
			dto.maxWaitTimeSeconds !== undefined &&
			dto.ringTimeoutSeconds > dto.maxWaitTimeSeconds
		) {
			throw new ConflictException(
				'ringTimeoutSeconds cannot be greater than maxWaitTimeSeconds',
			);
		}
	}

	private requireTenant(auth: AuthContext): string {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}
		return auth.tenantId;
	}
}
