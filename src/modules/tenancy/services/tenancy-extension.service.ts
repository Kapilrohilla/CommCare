import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Events } from 'src/constants/event.constant';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { UserService } from 'src/modules/iam/services/user.service';
import type { AuthContext } from 'src/shared/types/auth.types';
import {
	AssignExtensionsToUserDto,
	BulkExtensionAssignmentEventPayload,
	CreateTenantUserDto,
	UpdateTenantUserDto,
} from '../dto/tenancy-extension.dto';
import { TenancyService } from './tenancy.service';

@Injectable()
export class TenancyExtensionService {
	private readonly logger = new Logger(TenancyExtensionService.name);

	constructor(
		private readonly extensionService: ExtensionService,
		private readonly tenancyService: TenancyService,
		private readonly userService: UserService,
		private readonly eventProducer: EventProducer,
	) {}

	async enqueueBulkExtensionAssignment(count: number, tenantId: string) {
		await this.tenancyService.findById(tenantId);

		const available = await this.extensionService.countAvailableExtensions();
		if (count >= available) {
			throw new BadRequestException(
				`Cannot register ${count} extensions. Only ${available} available in pool`,
			);
		}

		const batchId = randomUUID();
		await this.eventProducer.publish(Events.bulkExtensionAssignment, {
			batchId,
			tenantId,
			count,
		});

		return {
			batchId,
			tenantId,
			count,
			message: 'Bulk extension registration queued',
		};
	}

	async handleEventBulkExtensionAssignment(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const data = payload as BulkExtensionAssignmentEventPayload;

		this.logger.log(
			`Handling ${eventName} for tenant ${data.tenantId} count ${data.count} (retry ${retryCount})`,
		);

		for (let index = 0; index < data.count; index++) {
			await this.extensionService.assignOneAvailableToTenant(data.tenantId);
			await this.tenancyService.onExtensionsReserved(data.tenantId);
		}

		await this.extensionService.ensureAvailableExtensionPool();
	}

	async getTenantExtensions(tenantId: string | null) {
		if (!tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}
		return this.extensionService.getExtensionsByTenantId(tenantId);
	}

	async getMyTenantExtensions(userId: string) {
		return this.extensionService.getExtensionsByUserId(userId);
	}

	async unassignExtension(extensionId: string, userId: string, tenantId: string | null) {
		if (!tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}
		const extension = await this.extensionService.unassignExtensionFromUser(tenantId, extensionId, userId);
		await this.tenancyService.onExtensionUnassigned(tenantId);
		return extension;
	}

	async unregisterExtension(extensionId: string, tenantId: string | null) {
		if (!tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}
		const extension = await this.extensionService.unregisterExtensionFromTenant(tenantId, extensionId);
		await this.tenancyService.onExtensionUnregistered(tenantId);
		return extension;
	}

	async createTenantUser(auth: AuthContext, dto: CreateTenantUserDto) {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}

		const user = await this.userService.createUser(dto.name, auth.tenantId);
		const extensions = await this.extensionService.assignExtensionsToUser(
			auth.tenantId,
			user.id,
			dto.extensionIds,
			{ name: dto.name, userId: user.id },
		);
		await this.tenancyService.onExtensionsAssigned(auth.tenantId, extensions.length);

		return { user: { id: user.id, name: user.name, tenantId: user.tenantId }, extensions };
	}

	async assignExtensionsToUser(auth: AuthContext, dto: AssignExtensionsToUserDto) {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}

		const user = await this.userService.findById(dto.userId);
		if (!user || user.tenantId !== auth.tenantId) {
			throw new NotFoundException('User not found in this tenant');
		}

		const extensions = await this.extensionService.assignExtensionsToUser(
			auth.tenantId,
			dto.userId,
			dto.extensionIds,
			{ name: user.name, userId: user.id },
		);
		await this.tenancyService.onExtensionsAssigned(auth.tenantId, extensions.length);

		return { user: { id: user.id, name: user.name }, extensions };
	}

	async updateTenantUser(auth: AuthContext, userId: string, dto: UpdateTenantUserDto) {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}

		const user = await this.userService.findById(userId);
		if (!user || user.tenantId !== auth.tenantId) {
			throw new NotFoundException('User not found in this tenant');
		}

		const updatedUser = await this.userService.updateName(user, dto.name);
		await this.extensionService.syncUserInfoOnExtensions(userId, {
			name: dto.name,
			userId,
		});

		return {
			user: { id: updatedUser.id, name: updatedUser.name, tenantId: updatedUser.tenantId },
		};
	}
}
