import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InboundRouteSourceType } from 'src/modules/routing/constants/inbound-routes.constant';
import { InboundRoutesService } from 'src/modules/routing/services/inbound-routes.service';
import { SipTrunkService } from 'src/modules/trunk/services/sip-trunk.service';
import { normalizeToE164 } from 'src/shared/utils/phone-number.util';
import { AuthContext } from 'src/shared/types/auth.types';
import { PhoneNumberStatus, PhoneNumberType } from '../constants/phone-number.constant';
import { CreatePhoneNumberDto, UpdatePhoneNumberDto } from '../dto/phone-number.dto';
import { PhoneNumber } from '../entity/phone-number.entity';
import { PhoneNumberFilters, PhoneNumberRepository } from '../repositories/phone-number.repository';

@Injectable()
export class PhoneNumbersService {
	private readonly logger = new Logger(PhoneNumbersService.name);

	constructor(
		private readonly phoneNumberRepository: PhoneNumberRepository,
		private readonly sipTrunkService: SipTrunkService,
		@Inject(forwardRef(() => InboundRoutesService))
		private readonly inboundRoutesService: InboundRoutesService,
	) {}

	async createPhoneNumber(
		auth: AuthContext,
		dto: CreatePhoneNumberDto,
	): Promise<PhoneNumber> {
		const tenantId = this.requireTenant(auth);
		const normalized = this.normalizeOrThrow(dto.number);

		await this.sipTrunkService.getTrunkById(auth, dto.sipTrunkId);
		await this.ensureUniqueNumber(normalized);

		const phoneNumber = new PhoneNumber();
		phoneNumber.id = randomUUID();
		phoneNumber.tenantId = tenantId;
		phoneNumber.sipTrunkId = dto.sipTrunkId;
		phoneNumber.number = normalized;
		phoneNumber.type = dto.type ?? PhoneNumberType.Did;
		phoneNumber.status = dto.status ?? PhoneNumberStatus.Active;
		phoneNumber.name = dto.name;
		phoneNumber.description = dto.description ?? null;

		return this.phoneNumberRepository.create(phoneNumber);
	}

	async listPhoneNumbers(
		auth: AuthContext,
		filters: PhoneNumberFilters,
	): Promise<PhoneNumber[]> {
		return this.phoneNumberRepository.getByTenantId(this.requireTenant(auth), filters);
	}

	async getPhoneNumberById(auth: AuthContext, id: string): Promise<PhoneNumber> {
		return this.getPhoneNumberForTenant(auth, id);
	}

	async updatePhoneNumber(
		auth: AuthContext,
		id: string,
		dto: UpdatePhoneNumberDto,
	): Promise<PhoneNumber> {
		const phoneNumber = await this.getPhoneNumberForTenant(auth, id);

		if (dto.sipTrunkId !== undefined && dto.sipTrunkId !== phoneNumber.sipTrunkId) {
			await this.sipTrunkService.getTrunkById(auth, dto.sipTrunkId);
			this.logger.warn(
				`Reassigning phone number ${phoneNumber.id} (${phoneNumber.number}) from trunk ${phoneNumber.sipTrunkId} to ${dto.sipTrunkId} by user ${auth.userId}`,
			);
			phoneNumber.sipTrunkId = dto.sipTrunkId;
		}

		if (dto.number !== undefined) {
			const normalized = this.normalizeOrThrow(dto.number);
			if (normalized !== phoneNumber.number) {
				await this.ensureUniqueNumber(normalized, phoneNumber.id);
				phoneNumber.number = normalized;
			}
		}

		if (dto.type !== undefined) {
			phoneNumber.type = dto.type;
		}
		if (dto.status !== undefined) {
			phoneNumber.status = dto.status;
		}
		if (dto.name !== undefined) {
			phoneNumber.name = dto.name;
		}
		if (dto.description !== undefined) {
			phoneNumber.description = dto.description;
		}

		return this.phoneNumberRepository.save(phoneNumber);
	}

	async deletePhoneNumber(auth: AuthContext, id: string): Promise<void> {
		const phoneNumber = await this.getPhoneNumberForTenant(auth, id);

		const referenced = await this.inboundRoutesService.existsRouteReferencingSource(
			InboundRouteSourceType.PhoneNumber,
			phoneNumber.id,
		);
		if (referenced) {
			throw new ConflictException({
				code: 'PHONE_NUMBER_IN_USE',
				message:
					'Phone number is referenced by an inbound route; reassign or delete the route before deleting this phone number',
			});
		}

		await this.phoneNumberRepository.delete(id);
	}

	/** Used by InboundRoutesService source validation. */
	async getActivePhoneNumberForTenant(tenantId: string, id: string): Promise<PhoneNumber> {
		const phoneNumber = await this.phoneNumberRepository.getByIdAndTenantId(id, tenantId);
		if (!phoneNumber || phoneNumber.status !== PhoneNumberStatus.Active) {
			throw new NotFoundException('Phone number not found or inactive');
		}
		return phoneNumber;
	}

	/** Unscoped by tenant — used by inbound-call resolution. */
	async findByNormalizedNumber(number: string): Promise<PhoneNumber | null> {
		return this.phoneNumberRepository.findByNumber(number);
	}

	private normalizeOrThrow(rawNumber: string): string {
		const normalized = normalizeToE164(rawNumber);
		if (!normalized) {
			throw new BadRequestException('number must be a valid phone number');
		}
		return normalized;
	}

	private async ensureUniqueNumber(number: string, excludeId?: string): Promise<void> {
		const exists = await this.phoneNumberRepository.existsByNumber(number, excludeId);
		if (exists) {
			throw new ConflictException({
				code: 'PHONE_NUMBER_ALREADY_EXISTS',
				message: `Phone number ${number} is already registered`,
			});
		}
	}

	private async getPhoneNumberForTenant(
		auth: AuthContext,
		id: string,
	): Promise<PhoneNumber> {
		const tenantId = this.requireTenant(auth);
		const phoneNumber = await this.phoneNumberRepository.getByIdAndTenantId(id, tenantId);
		if (!phoneNumber) {
			throw new NotFoundException('Phone number not found');
		}
		return phoneNumber;
	}

	private requireTenant(auth: AuthContext): string {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}
		return auth.tenantId;
	}
}
