import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PhoneNumberStatus } from 'src/modules/phoneNumbers/constants/phone-number.constant';
import {
	InboundRouteDestinationType,
	InboundRouteSourceType,
} from '../constants/inbound-routes.constant';
import { InboundRoute } from '../entity/inbound-route.entity';
import { InboundRoutesService } from './inbound-routes.service';

// got is ESM-only; transitively imported via the webhook dispatcher
jest.mock('got', () => ({ __esModule: true, default: jest.fn() }));

describe('InboundRoutesService', () => {
	const tenantAuth = { tenantId: 'tenant-1' } as never;

	function buildService(overrides?: {
		getByIdAndTenantId?: jest.Mock;
		create?: jest.Mock;
		save?: jest.Mock;
		getEnabledBySourceTypeAndId?: jest.Mock;
		existsEnabledBySourceTypeAndId?: jest.Mock;
		existsBySourceValue?: jest.Mock;
		existsBySource?: jest.Mock;
		getExtensionsByTenantId?: jest.Mock;
		getIvrById?: jest.Mock;
		getEnabledQueueForTenant?: jest.Mock;
		getActivePhoneNumberForTenant?: jest.Mock;
		findByNormalizedNumber?: jest.Mock;
	}) {
		const inboundRouteRepository = {
			create: overrides?.create ?? jest.fn(async (route: InboundRoute) => route),
			save: overrides?.save ?? jest.fn(async (route: InboundRoute) => route),
			delete: jest.fn(async () => undefined),
			getById: jest.fn(async () => null),
			getByIdAndTenantId: overrides?.getByIdAndTenantId ?? jest.fn(async () => null),
			getByTenantId: jest.fn(async () => []),
			getEnabledBySourceValue: jest.fn(async () => null),
			getEnabledBySourceTypeAndId:
				overrides?.getEnabledBySourceTypeAndId ?? jest.fn(async () => null),
			existsBySource: overrides?.existsBySource ?? jest.fn(async () => false),
			existsEnabledBySourceTypeAndId:
				overrides?.existsEnabledBySourceTypeAndId ?? jest.fn(async () => false),
			existsBySourceValue: overrides?.existsBySourceValue ?? jest.fn(async () => false),
			existsByDestination: jest.fn(async () => false),
		};
		const extensionService = {
			getExtensionsByTenantId:
				overrides?.getExtensionsByTenantId ?? jest.fn(async () => []),
		};
		const ivrService = {
			getIvrById: overrides?.getIvrById ?? jest.fn(async () => ({ id: 'ivr-1' })),
		};
		const queuesService = {
			getEnabledQueueForTenant:
				overrides?.getEnabledQueueForTenant ?? jest.fn(async () => ({ id: 'queue-1' })),
		};
		const phoneNumbersService = {
			getActivePhoneNumberForTenant:
				overrides?.getActivePhoneNumberForTenant ??
				jest.fn(async () => ({ id: 'phone-1', number: '+14155551234', status: PhoneNumberStatus.Active })),
			findByNormalizedNumber:
				overrides?.findByNormalizedNumber ?? jest.fn(async () => null),
		};
		return {
			service: new InboundRoutesService(
				inboundRouteRepository as never,
				extensionService as never,
				ivrService as never,
				queuesService as never,
				phoneNumbersService as never,
			),
			inboundRouteRepository,
			extensionService,
			phoneNumbersService,
		};
	}

	describe('createInboundRoute — phone_number source', () => {
		it('resolves and derives sourceValue from the referenced phone number', async () => {
			const { service } = buildService();
			const route = await service.createInboundRoute(tenantAuth, {
				sourceType: InboundRouteSourceType.PhoneNumber,
				sourceId: 'phone-1',
				destinationType: InboundRouteDestinationType.Hangup,
			} as never);
			expect(route.sourceValue).toBe('+14155551234');
			expect(route.sourceId).toBe('phone-1');
		});

		it('rejects a client-supplied sourceValue by ignoring it (derives server-side)', async () => {
			const { service } = buildService();
			const route = await service.createInboundRoute(tenantAuth, {
				sourceType: InboundRouteSourceType.PhoneNumber,
				sourceId: 'phone-1',
				sourceValue: 'client-supplied-garbage',
				destinationType: InboundRouteDestinationType.Hangup,
			} as never);
			expect(route.sourceValue).toBe('+14155551234');
		});

		it('throws when the phone number is not found/inactive for the tenant', async () => {
			const { service } = buildService({
				getActivePhoneNumberForTenant: jest.fn(async () => {
					throw new NotFoundException('Phone number not found or inactive');
				}),
			});
			await expect(
				service.createInboundRoute(tenantAuth, {
					sourceType: InboundRouteSourceType.PhoneNumber,
					sourceId: 'phone-1',
					destinationType: InboundRouteDestinationType.Hangup,
				} as never),
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it('rejects creating a second enabled route for the same phone number', async () => {
			const { service } = buildService({
				existsEnabledBySourceTypeAndId: jest.fn(async () => true),
			});
			await expect(
				service.createInboundRoute(tenantAuth, {
					sourceType: InboundRouteSourceType.PhoneNumber,
					sourceId: 'phone-1',
					destinationType: InboundRouteDestinationType.Hangup,
				} as never),
			).rejects.toBeInstanceOf(ConflictException);
		});

		it('allows creating a disabled route even if an enabled one already exists', async () => {
			const existsEnabledBySourceTypeAndId = jest.fn(async () => true);
			const { service } = buildService({ existsEnabledBySourceTypeAndId });
			const route = await service.createInboundRoute(tenantAuth, {
				sourceType: InboundRouteSourceType.PhoneNumber,
				sourceId: 'phone-1',
				destinationType: InboundRouteDestinationType.Hangup,
				enabled: false,
			} as never);
			expect(route.enabled).toBe(false);
			expect(existsEnabledBySourceTypeAndId).not.toHaveBeenCalled();
		});
	});

	describe('updateInboundRoute — phone_number conflict guard', () => {
		function existingRoute(overrides?: Partial<InboundRoute>): InboundRoute {
			const route = new InboundRoute();
			route.id = 'route-1';
			route.tenantId = 'tenant-1';
			route.sourceType = InboundRouteSourceType.PhoneNumber;
			route.sourceId = 'phone-1';
			route.sourceValue = '+14155551234';
			route.destinationType = InboundRouteDestinationType.Hangup;
			route.enabled = false;
			return Object.assign(route, overrides);
		}

		it('checks for conflicts when re-enabling an existing phone_number route', async () => {
			const existsEnabledBySourceTypeAndId = jest.fn(async () => true);
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => existingRoute()),
				existsEnabledBySourceTypeAndId,
			});
			await expect(
				service.updateInboundRoute(tenantAuth, 'route-1', { enabled: true } as never),
			).rejects.toBeInstanceOf(ConflictException);
			expect(existsEnabledBySourceTypeAndId).toHaveBeenCalledWith(
				InboundRouteSourceType.PhoneNumber,
				'phone-1',
				'route-1',
			);
		});

		it('does not conflict-check when the route stays disabled', async () => {
			const existsEnabledBySourceTypeAndId = jest.fn(async () => true);
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => existingRoute()),
				existsEnabledBySourceTypeAndId,
			});
			await service.updateInboundRoute(tenantAuth, 'route-1', {
				destinationType: InboundRouteDestinationType.Hangup,
			} as never);
			expect(existsEnabledBySourceTypeAndId).not.toHaveBeenCalled();
		});
	});

	describe('findEnabledRouteByDid', () => {
		it('returns null when the DID cannot be normalized', async () => {
			const { service, phoneNumbersService } = buildService();
			await expect(service.findEnabledRouteByDid('not-a-number')).resolves.toBeNull();
			expect(phoneNumbersService.findByNormalizedNumber).not.toHaveBeenCalled();
		});

		it('returns null when no phone number matches', async () => {
			const { service } = buildService({
				findByNormalizedNumber: jest.fn(async () => null),
			});
			await expect(service.findEnabledRouteByDid('+14155551234')).resolves.toBeNull();
		});

		it('returns null when the matched phone number is inactive', async () => {
			const { service } = buildService({
				findByNormalizedNumber: jest.fn(async () => ({
					id: 'phone-1',
					status: PhoneNumberStatus.Inactive,
				})),
			});
			await expect(service.findEnabledRouteByDid('+14155551234')).resolves.toBeNull();
		});

		it('resolves the enabled route for the matched phone number', async () => {
			const route = new InboundRoute();
			route.id = 'route-1';
			const getEnabledBySourceTypeAndId = jest.fn(async () => route);
			const { service } = buildService({
				findByNormalizedNumber: jest.fn(async () => ({
					id: 'phone-1',
					status: PhoneNumberStatus.Active,
				})),
				getEnabledBySourceTypeAndId,
			});
			await expect(service.findEnabledRouteByDid('+1 (415) 555-1234')).resolves.toBe(route);
			expect(getEnabledBySourceTypeAndId).toHaveBeenCalledWith(
				InboundRouteSourceType.PhoneNumber,
				'phone-1',
			);
		});

		it('never throws, even without a tenant on the auth context', async () => {
			// findEnabledRouteByDid takes no auth — this just documents the no-throw contract
			// relied on by InboundRouteCallWorkflowService.
			const { service } = buildService();
			await expect(service.findEnabledRouteByDid('')).resolves.toBeNull();
		});
	});

	describe('existsRouteReferencingSource', () => {
		it('delegates to the repository', async () => {
			const existsBySource = jest.fn(async () => true);
			const { service } = buildService({ existsBySource });
			await expect(
				service.existsRouteReferencingSource(InboundRouteSourceType.PhoneNumber, 'phone-1'),
			).resolves.toBe(true);
			expect(existsBySource).toHaveBeenCalledWith(
				InboundRouteSourceType.PhoneNumber,
				'phone-1',
			);
		});
	});

	it('throws ForbiddenException without a tenant', async () => {
		const { service } = buildService();
		await expect(
			service.createInboundRoute({ tenantId: null } as never, {
				sourceType: InboundRouteSourceType.PhoneNumber,
				sourceId: 'phone-1',
				destinationType: InboundRouteDestinationType.Hangup,
			} as never),
		).rejects.toBeInstanceOf(ForbiddenException);
	});
});
