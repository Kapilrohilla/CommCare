import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { IVRService } from 'src/modules/ivr/services/ivr.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { AuthContext } from 'src/shared/types/auth.types';
import {
	InboundRouteDestinationType,
	InboundRouteSourceType,
} from '../constants/inbound-routes.constant';
import {
	CreateInboundRouteDto,
	UpdateInboundRouteDto,
} from '../dto/inbound-route.dto';
import { InboundRoute } from '../entity/inbound-route.entity';
import { InboundRouteRepository } from '../repositories/inbound-route.repository';

@Injectable()
export class InboundRoutesService {
	constructor(
		private readonly inboundRouteRepository: InboundRouteRepository,
		private readonly extensionService: ExtensionService,
		private readonly ivrService: IVRService,
	) {}

	async createInboundRoute(
		auth: AuthContext,
		dto: CreateInboundRouteDto,
	): Promise<InboundRoute> {
		const tenantId = this.requireTenant(auth);
		await this.validateSource(auth, dto);
		await this.validateDestination(auth, dto);
		await this.ensureUniqueSourceValue(dto.sourceValue);

		const route = new InboundRoute();
		route.tenantId = tenantId;
		route.sourceType = dto.sourceType;
		route.sourceId = dto.sourceId ?? null;
		route.sourceValue = dto.sourceValue ?? null;
		route.destinationType = dto.destinationType;
		route.destinationId = dto.destinationId ?? null;
		route.destinationValue = dto.destinationValue ?? null;
		route.enabled = dto.enabled ?? true;

		return this.inboundRouteRepository.create(route);
	}

	async getInboundRoutesByTenant(auth: AuthContext): Promise<InboundRoute[]> {
		return this.inboundRouteRepository.getByTenantId(this.requireTenant(auth));
	}

	async getInboundRouteById(
		auth: AuthContext,
		id: string,
	): Promise<InboundRoute> {
		return this.getRouteForTenant(auth, id);
	}

	async updateInboundRoute(
		auth: AuthContext,
		id: string,
		dto: UpdateInboundRouteDto,
	): Promise<InboundRoute> {
		const route = await this.getRouteForTenant(auth, id);

		const nextSource = {
			sourceType: dto.sourceType ?? route.sourceType,
			sourceId: dto.sourceId !== undefined ? dto.sourceId : route.sourceId,
			sourceValue:
				dto.sourceValue !== undefined ? dto.sourceValue : route.sourceValue,
		};

		const nextDestination = {
			destinationType: dto.destinationType ?? route.destinationType,
			destinationId:
				dto.destinationId !== undefined
					? dto.destinationId
					: route.destinationId,
			destinationValue:
				dto.destinationValue !== undefined
					? dto.destinationValue
					: route.destinationValue,
		};

		if (
			dto.sourceType !== undefined ||
			dto.sourceId !== undefined ||
			dto.sourceValue !== undefined
		) {
			await this.validateSource(auth, nextSource);
			if (nextSource.sourceValue) {
				await this.ensureUniqueSourceValue(nextSource.sourceValue, route.id);
			}
			route.sourceType = nextSource.sourceType;
			route.sourceId = nextSource.sourceId ?? null;
			route.sourceValue = nextSource.sourceValue ?? null;
		}

		if (
			dto.destinationType !== undefined ||
			dto.destinationId !== undefined ||
			dto.destinationValue !== undefined
		) {
			await this.validateDestination(auth, nextDestination);
			route.destinationType = nextDestination.destinationType;
			route.destinationId = nextDestination.destinationId ?? null;
			route.destinationValue = nextDestination.destinationValue ?? null;
		}

		if (dto.enabled !== undefined) {
			route.enabled = dto.enabled;
		}

		return this.inboundRouteRepository.save(route);
	}

	async deleteInboundRoute(auth: AuthContext, id: string): Promise<void> {
		await this.getRouteForTenant(auth, id);
		await this.inboundRouteRepository.delete(id);
	}

	async findEnabledRouteByDid(did: string): Promise<InboundRoute | null> {
		if (!did.trim()) {
			return null;
		}
		return this.inboundRouteRepository.getEnabledBySourceValue(did);
	}

	private async ensureUniqueSourceValue(
		sourceValue: string | null | undefined,
		excludeId?: string,
	): Promise<void> {
		if (!sourceValue?.trim()) {
			return;
		}

		const exists = await this.inboundRouteRepository.existsBySourceValue(
			sourceValue,
			excludeId,
		);
		if (exists) {
			throw new ConflictException(
				`Inbound route with sourceValue ${sourceValue} already exists`,
			);
		}
	}

	private async getRouteForTenant(
		auth: AuthContext,
		id: string,
	): Promise<InboundRoute> {
		const tenantId = this.requireTenant(auth);
		const route = await this.inboundRouteRepository.getByIdAndTenantId(
			id,
			tenantId,
		);

		if (!route) {
			throw new NotFoundException('Inbound route not found');
		}

		return route;
	}

	private async validateSource(
		auth: AuthContext,
		dto: {
			sourceType: InboundRouteSourceType;
			sourceId?: string | null;
			sourceValue?: string | null;
		},
	): Promise<void> {
		if (dto.sourceType !== InboundRouteSourceType.Extension) {
			return;
		}

		const tenantId = this.requireTenant(auth);
		const extensions = await this.extensionService.getExtensionsByTenantId(
			tenantId,
		);

		if (!extensions.some((extension) => extension.id === dto.sourceId)) {
			throw new NotFoundException('Source extension not found');
		}
	}

	private async validateDestination(
		auth: AuthContext,
		dto: {
			destinationType: InboundRouteDestinationType;
			destinationId?: string | null;
			destinationValue?: string | null;
		},
	): Promise<void> {
		switch (dto.destinationType) {
			case InboundRouteDestinationType.Hangup:
			case InboundRouteDestinationType.ExternalNumber:
				return;
			case InboundRouteDestinationType.Extension:
			case InboundRouteDestinationType.Voicemail: {
				const tenantId = this.requireTenant(auth);
				const extensions = await this.extensionService.getExtensionsByTenantId(
					tenantId,
				);
				if (!extensions.some((extension) => extension.id === dto.destinationId)) {
					throw new NotFoundException('Destination extension not found');
				}
				return;
			}
			case InboundRouteDestinationType.IVR:
				await this.ivrService.getIvrById(auth, dto.destinationId!);
				return;
			case InboundRouteDestinationType.Queue:
				return;
		}
	}

	private requireTenant(auth: AuthContext): string {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}

		return auth.tenantId;
	}
}
