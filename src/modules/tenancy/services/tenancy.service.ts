import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { UserService } from 'src/modules/iam/services/user.service';
import { SessionService } from 'src/modules/iam/services/session.service';
import type { AuthContext } from 'src/shared/types/auth.types';
import { CreateTenancyDto, UpdateTenancyDto } from '../dto/tenancy.dto';
import { Tenants } from '../entity/tenants.entity';
import { TenancyRepository } from '../repositories/tenancy.repository';

@Injectable()
export class TenancyService {
	constructor(
		private readonly tenancyRepository: TenancyRepository,
		private readonly userService: UserService,
		private readonly sessionService: SessionService,
	) {}

	findAll(): Promise<Tenants[]> {
		return this.tenancyRepository.findAll();
	}

	async findById(id: string): Promise<Tenants> {
		const tenant = await this.tenancyRepository.findById(id);
		if (!tenant) {
			throw new NotFoundException('Tenant not found');
		}
		return tenant;
	}

	findByIdOrNull(id: string): Promise<Tenants | null> {
		return this.tenancyRepository.findById(id);
	}

	create(dto: CreateTenancyDto): Promise<Tenants> {
		return this.tenancyRepository.create(dto.name);
	}

	update(id: string, dto: UpdateTenancyDto): Promise<Tenants> {
		return this.tenancyRepository.update(id, dto.name);
	}

	async delete(id: string): Promise<void> {
		await this.tenancyRepository.delete(id);
	}

	async createMyTenancy(auth: AuthContext, dto: CreateTenancyDto) {
		const user = await this.userService.findById(auth.userId);
		if (!user) {
			throw new UnauthorizedException('User not found');
		}
		if (user.tenantId) {
			throw new ConflictException('User already has a tenant assigned');
		}

		const tenant = await this.tenancyRepository.create(dto.name);
		await this.userService.assignTenant(user, tenant.id);
		const session = await this.sessionService.assignTenant(auth.sessionId, tenant.id);
		const tokens = await this.sessionService.generateTokens(session);

		return {
			tenant: { id: tenant.id, name: tenant.name },
			user: { id: user.id, name: user.name, tenantId: tenant.id },
			requiresTenant: false,
			...tokens,
		};
	}

	async getMyTenancy(auth: AuthContext) {
		const user = await this.userService.findById(auth.userId);
		if (!user) {
			throw new UnauthorizedException('User not found');
		}
		if (!user.tenantId) {
			throw new NotFoundException('User does not have a tenant assigned');
		}
		const tenant = await this.tenancyRepository.findById(user.tenantId);
		if (!tenant) {
			throw new NotFoundException('Tenant not found');
		}
		return tenant;
	}
}
