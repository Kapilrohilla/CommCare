import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PhoneNumberStatus, PhoneNumberType } from '../constants/phone-number.constant';
import { PhoneNumber } from '../entity/phone-number.entity';
import { PhoneNumbersService } from './phone-numbers.service';

describe('PhoneNumbersService', () => {
	const tenantAuth = { tenantId: 'tenant-1', userId: 'user-1' } as never;

	function buildService(overrides?: {
		getByIdAndTenantId?: jest.Mock;
		getByTenantId?: jest.Mock;
		findByNumber?: jest.Mock;
		existsByNumber?: jest.Mock;
		create?: jest.Mock;
		save?: jest.Mock;
		delete?: jest.Mock;
		getTrunkById?: jest.Mock;
		existsRouteReferencingSource?: jest.Mock;
	}) {
		const phoneNumberRepository = {
			create: overrides?.create ?? jest.fn(async (entity: PhoneNumber) => entity),
			save: overrides?.save ?? jest.fn(async (entity: PhoneNumber) => entity),
			delete: overrides?.delete ?? jest.fn(async () => undefined),
			getById: jest.fn(async () => null),
			getByIdAndTenantId: overrides?.getByIdAndTenantId ?? jest.fn(async () => null),
			getByTenantId: overrides?.getByTenantId ?? jest.fn(async () => []),
			findByNumber: overrides?.findByNumber ?? jest.fn(async () => null),
			existsByNumber: overrides?.existsByNumber ?? jest.fn(async () => false),
		};
		const sipTrunkService = {
			getTrunkById: overrides?.getTrunkById ?? jest.fn(async () => ({ id: 'trunk-1' })),
		};
		const inboundRoutesService = {
			existsRouteReferencingSource:
				overrides?.existsRouteReferencingSource ?? jest.fn(async () => false),
		};
		return {
			service: new PhoneNumbersService(
				phoneNumberRepository as never,
				sipTrunkService as never,
				inboundRoutesService as never,
			),
			phoneNumberRepository,
			sipTrunkService,
			inboundRoutesService,
		};
	}

	describe('createPhoneNumber', () => {
		it('rejects an invalid phone number', async () => {
			const { service } = buildService();
			await expect(
				service.createPhoneNumber(tenantAuth, {
					sipTrunkId: 'trunk-1',
					number: 'not-a-number',
					name: 'Main office',
				}),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it('rejects when the SIP trunk is not found for this tenant', async () => {
			const getTrunkById = jest.fn(async () => {
				throw new NotFoundException('SIP trunk not found');
			});
			const { service } = buildService({ getTrunkById });
			await expect(
				service.createPhoneNumber(tenantAuth, {
					sipTrunkId: 'trunk-1',
					number: '+14155551234',
					name: 'Main office',
				}),
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it('rejects a duplicate number', async () => {
			const { service } = buildService({ existsByNumber: jest.fn(async () => true) });
			await expect(
				service.createPhoneNumber(tenantAuth, {
					sipTrunkId: 'trunk-1',
					number: '+14155551234',
					name: 'Main office',
				}),
			).rejects.toBeInstanceOf(ConflictException);
		});

		it('creates and normalizes the number', async () => {
			const { service, phoneNumberRepository } = buildService();
			const created = await service.createPhoneNumber(tenantAuth, {
				sipTrunkId: 'trunk-1',
				number: '+1 415 555 1234',
				name: 'Main office',
			});
			expect(created.number).toBe('+14155551234');
			expect(created.tenantId).toBe('tenant-1');
			expect(created.type).toBe(PhoneNumberType.Did);
			expect(created.status).toBe(PhoneNumberStatus.Active);
			expect(phoneNumberRepository.create).toHaveBeenCalledTimes(1);
		});

		it('throws when tenant is missing', async () => {
			const { service } = buildService();
			await expect(
				service.createPhoneNumber({ tenantId: null } as never, {
					sipTrunkId: 'trunk-1',
					number: '+14155551234',
					name: 'Main office',
				}),
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe('updatePhoneNumber', () => {
		function existing(overrides?: Partial<PhoneNumber>): PhoneNumber {
			const phoneNumber = new PhoneNumber();
			phoneNumber.id = 'phone-1';
			phoneNumber.tenantId = 'tenant-1';
			phoneNumber.sipTrunkId = 'trunk-1';
			phoneNumber.number = '+14155551234';
			phoneNumber.type = PhoneNumberType.Did;
			phoneNumber.status = PhoneNumberStatus.Active;
			phoneNumber.name = 'Main office';
			return Object.assign(phoneNumber, overrides);
		}

		it('re-validates the trunk on reassignment', async () => {
			const getTrunkById = jest.fn(async () => ({ id: 'trunk-2' }));
			const { service, sipTrunkService } = buildService({
				getByIdAndTenantId: jest.fn(async () => existing()),
				getTrunkById,
			});
			const updated = await service.updatePhoneNumber(tenantAuth, 'phone-1', {
				sipTrunkId: 'trunk-2',
			});
			expect(updated.sipTrunkId).toBe('trunk-2');
			expect(sipTrunkService.getTrunkById).toHaveBeenCalledWith(tenantAuth, 'trunk-2');
		});

		it('rejects reassigning the number to a duplicate value', async () => {
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => existing()),
				existsByNumber: jest.fn(async () => true),
			});
			await expect(
				service.updatePhoneNumber(tenantAuth, 'phone-1', { number: '+14155559999' }),
			).rejects.toBeInstanceOf(ConflictException);
		});
	});

	describe('deletePhoneNumber', () => {
		it('blocks deletion when referenced by an inbound route', async () => {
			const phoneNumber = new PhoneNumber();
			phoneNumber.id = 'phone-1';
			phoneNumber.tenantId = 'tenant-1';
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => phoneNumber),
				existsRouteReferencingSource: jest.fn(async () => true),
			});
			await expect(service.deletePhoneNumber(tenantAuth, 'phone-1')).rejects.toBeInstanceOf(
				ConflictException,
			);
		});

		it('deletes when not referenced', async () => {
			const phoneNumber = new PhoneNumber();
			phoneNumber.id = 'phone-1';
			phoneNumber.tenantId = 'tenant-1';
			const { service, phoneNumberRepository } = buildService({
				getByIdAndTenantId: jest.fn(async () => phoneNumber),
			});
			await service.deletePhoneNumber(tenantAuth, 'phone-1');
			expect(phoneNumberRepository.delete).toHaveBeenCalledWith('phone-1');
		});
	});

	describe('getActivePhoneNumberForTenant', () => {
		it('throws NotFoundException when missing', async () => {
			const { service } = buildService();
			await expect(
				service.getActivePhoneNumberForTenant('tenant-1', 'phone-1'),
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it('throws NotFoundException when inactive', async () => {
			const phoneNumber = new PhoneNumber();
			phoneNumber.id = 'phone-1';
			phoneNumber.status = PhoneNumberStatus.Inactive;
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => phoneNumber),
			});
			await expect(
				service.getActivePhoneNumberForTenant('tenant-1', 'phone-1'),
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it('returns the phone number when active', async () => {
			const phoneNumber = new PhoneNumber();
			phoneNumber.id = 'phone-1';
			phoneNumber.status = PhoneNumberStatus.Active;
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => phoneNumber),
			});
			await expect(
				service.getActivePhoneNumberForTenant('tenant-1', 'phone-1'),
			).resolves.toBe(phoneNumber);
		});
	});
});
