import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
	forwardRef,
} from '@nestjs/common';
import { IVRService } from 'src/modules/ivr/services/ivr.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { QueuesService } from 'src/modules/inboundQueues/services/queues.service';
import { PhoneNumberStatus } from 'src/modules/phoneNumbers/constants/phone-number.constant';
import { PhoneNumbersService } from 'src/modules/phoneNumbers/services/phone-numbers.service';
import { normalizeToE164 } from 'src/shared/utils/phone-number.util';
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
		@Inject(forwardRef(() => QueuesService))
		private readonly queuesService: QueuesService,
		@Inject(forwardRef(() => PhoneNumbersService))
		private readonly phoneNumbersService: PhoneNumbersService,
	) {}

	async createInboundRoute(
		auth: AuthContext,
		dto: CreateInboundRouteDto,
	): Promise<InboundRoute> {
		const tenantId = this.requireTenant(auth);
		const resolvedSourceValue = await this.validateAndResolveSource(auth, dto);
		await this.validateDestination(auth, dto);

		const enabled = dto.enabled ?? true;
		if (dto.sourceType === InboundRouteSourceType.PhoneNumber) {
			if (enabled) {
				await this.ensureNoConflictingPhoneNumberRoute(dto.sourceId!);
			}
		} else {
			await this.ensureUniqueSourceValue(resolvedSourceValue);
		}

		const route = new InboundRoute();
		route.tenantId = tenantId;
		route.sourceType = dto.sourceType;
		route.sourceId = dto.sourceId ?? null;
		route.sourceValue = resolvedSourceValue;
		route.destinationType = dto.destinationType;
		route.destinationId = dto.destinationId ?? null;
		route.destinationValue = dto.destinationValue ?? null;
		route.enabled = enabled;

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

		const nextEnabled = dto.enabled !== undefined ? dto.enabled : route.enabled;

		if (
			dto.sourceType !== undefined ||
			dto.sourceId !== undefined ||
			dto.sourceValue !== undefined
		) {
			const resolvedSourceValue = await this.validateAndResolveSource(
				auth,
				nextSource,
			);
			if (
				nextSource.sourceType !== InboundRouteSourceType.PhoneNumber &&
				resolvedSourceValue
			) {
				await this.ensureUniqueSourceValue(resolvedSourceValue, route.id);
			}
			route.sourceType = nextSource.sourceType;
			route.sourceId = nextSource.sourceId ?? null;
			route.sourceValue = resolvedSourceValue;
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

		if (route.sourceType === InboundRouteSourceType.PhoneNumber && nextEnabled) {
			await this.ensureNoConflictingPhoneNumberRoute(route.sourceId!, route.id);
		}

		return this.inboundRouteRepository.save(route);
	}

	async deleteInboundRoute(auth: AuthContext, id: string): Promise<void> {
		await this.getRouteForTenant(auth, id);
		await this.inboundRouteRepository.delete(id);
	}

	async findEnabledRouteByDid(did: string): Promise<InboundRoute | null> {
		const normalized = normalizeToE164(did);
		if (!normalized) {
			return null;
		}

		const phoneNumber = await this.phoneNumbersService.findByNormalizedNumber(normalized);
		if (!phoneNumber || phoneNumber.status !== PhoneNumberStatus.Active) {
			return null;
		}

		return this.inboundRouteRepository.getEnabledBySourceTypeAndId(
			InboundRouteSourceType.PhoneNumber,
			phoneNumber.id,
		);
	}

	private async ensureNoConflictingPhoneNumberRoute(
		sourceId: string,
		excludeId?: string,
	): Promise<void> {
		const exists = await this.inboundRouteRepository.existsEnabledBySourceTypeAndId(
			InboundRouteSourceType.PhoneNumber,
			sourceId,
			excludeId,
		);
		if (exists) {
			throw new ConflictException({
				code: 'PHONE_NUMBER_ROUTE_CONFLICT',
				message: 'An enabled inbound route already exists for this phone number',
			});
		}
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

	/** Validates the source reference and returns the sourceValue to persist. */
	private async validateAndResolveSource(
		auth: AuthContext,
		dto: {
			sourceType: InboundRouteSourceType;
			sourceId?: string | null;
			sourceValue?: string | null;
		},
	): Promise<string | null> {
		switch (dto.sourceType) {
			case InboundRouteSourceType.Extension: {
				const tenantId = this.requireTenant(auth);
				const extensions = await this.extensionService.getExtensionsByTenantId(
					tenantId,
				);
				if (!extensions.some((extension) => extension.id === dto.sourceId)) {
					throw new NotFoundException('Source extension not found');
				}
				return dto.sourceValue?.trim() || null;
			}
			case InboundRouteSourceType.PhoneNumber: {
				const tenantId = this.requireTenant(auth);
				const phoneNumber = await this.phoneNumbersService.getActivePhoneNumberForTenant(
					tenantId,
					dto.sourceId!,
				);
				return phoneNumber.number;
			}
			case InboundRouteSourceType.FeatureCode:
				return dto.sourceValue?.trim() || null;
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
			case InboundRouteDestinationType.Queue: {
				const tenantId = this.requireTenant(auth);
				await this.queuesService.getEnabledQueueForTenant(tenantId, dto.destinationId!);
				return;
			}
		}
	}

	/** Used by QueuesService to block deleting a queue still targeted by a route. */
	async existsRouteReferencingDestination(
		destinationType: InboundRouteDestinationType,
		destinationId: string,
	): Promise<boolean> {
		return this.inboundRouteRepository.existsByDestination(destinationType, destinationId);
	}

	/** Used by PhoneNumbersService to block deleting a phone number still referenced by a route. */
	async existsRouteReferencingSource(
		sourceType: InboundRouteSourceType,
		sourceId: string,
	): Promise<boolean> {
		return this.inboundRouteRepository.existsBySource(sourceType, sourceId);
	}

	private requireTenant(auth: AuthContext): string {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}

		return auth.tenantId;
	}
}
