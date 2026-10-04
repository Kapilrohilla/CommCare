import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IVROptionDestinationType } from '../constants/ivr-options.constant';
import { IVRInvalidKeyAction } from '../constants/ivr.constant';
import { IVREntity } from '../entity/ivr.entity';
import { IVROptionEntity } from '../entity/ivr-options.entity';
import { IVRService } from './ivr.service';

// got is ESM-only; transitively imported via the webhook dispatcher
jest.mock('got', () => ({ __esModule: true, default: jest.fn() }));

describe('IVRService', () => {
	const tenantAuth = { tenantId: 'tenant-1' } as never;

	function buildService(overrides?: {
		getByIdAndTenantId?: jest.Mock;
		create?: jest.Mock;
		save?: jest.Mock;
		getByIvrIdAndDigit?: jest.Mock;
		getSystemRecordingById?: jest.Mock;
		getExtensionsByTenantId?: jest.Mock;
		getEnabledQueueForTenant?: jest.Mock;
	}) {
		const ivrRepository = {
			create: overrides?.create ?? jest.fn(async (ivr: IVREntity) => ivr),
			save: overrides?.save ?? jest.fn(async (ivr: IVREntity) => ivr),
			delete: jest.fn(async () => undefined),
			getByIdAndTenantId: overrides?.getByIdAndTenantId ?? jest.fn(async () => null),
			getByTenantId: jest.fn(async () => []),
		};
		const ivrOptionsService = {
			create: jest.fn(async (option: IVROptionEntity) => option),
			save: jest.fn(async (option: IVROptionEntity) => option),
			delete: jest.fn(async () => undefined),
			deleteByIvrId: jest.fn(async () => undefined),
			getByIdAndIvrId: jest.fn(async () => null),
			getByIvrId: jest.fn(async () => []),
			getByIvrIdAndDigit: overrides?.getByIvrIdAndDigit ?? jest.fn(async () => null),
		};
		const ivrSessionService = {
			create: jest.fn(),
			save: jest.fn(),
			delete: jest.fn(),
			getByIdAndTenantId: jest.fn(),
			getByCallIdAndTenantId: jest.fn(),
			getByIvrId: jest.fn(),
		};
		const systemRecordingService = {
			getSystemRecordingById:
				overrides?.getSystemRecordingById ??
				jest.fn(async () => ({ status: 'active' })),
		};
		const extensionService = {
			getExtensionsByTenantId:
				overrides?.getExtensionsByTenantId ?? jest.fn(async () => []),
		};
		const queuesService = {
			getEnabledQueueForTenant:
				overrides?.getEnabledQueueForTenant ?? jest.fn(async () => ({ id: 'queue-1' })),
		};

		return {
			service: new IVRService(
				ivrRepository as never,
				ivrOptionsService as never,
				ivrSessionService as never,
				systemRecordingService as never,
				extensionService as never,
				queuesService as never,
			),
			ivrRepository,
			ivrOptionsService,
			systemRecordingService,
			extensionService,
			queuesService,
		};
	}

	describe('createIvr', () => {
		it('applies defaults for the new config fields', async () => {
			const { service } = buildService();
			const ivr = await service.createIvr(tenantAuth, {
				name: 'Main Menu',
			} as never);
			expect(ivr.enabled).toBe(true);
			expect(ivr.inputTimeoutSeconds).toBe(5);
			expect(ivr.maxInvalidRetries).toBe(3);
			expect(ivr.invalidKeyAction).toBe(IVRInvalidKeyAction.ReplayAnnouncement);
			expect(ivr.finalTimeoutDestinationType).toBe(IVROptionDestinationType.HANGUP);
		});

		it('throws without a tenant', async () => {
			const { service } = buildService();
			await expect(
				service.createIvr({ tenantId: null } as never, { name: 'Main Menu' } as never),
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe('validateDestination — QUEUE (via createOption)', () => {
		it('validates the queue exists and is enabled', async () => {
			const getEnabledQueueForTenant = jest.fn(async () => ({ id: 'queue-1' }));
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => new IVREntity()),
				getEnabledQueueForTenant,
			});
			await service.createOption(tenantAuth, 'ivr-1', {
				digit: '1',
				destinationType: IVROptionDestinationType.QUEUE,
				destinationId: 'queue-1',
			} as never);
			expect(getEnabledQueueForTenant).toHaveBeenCalledWith('tenant-1', 'queue-1');
		});

		it('rejects a missing/disabled queue', async () => {
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => new IVREntity()),
				getEnabledQueueForTenant: jest.fn(async () => {
					throw new NotFoundException('Queue not found or disabled');
				}),
			});
			await expect(
				service.createOption(tenantAuth, 'ivr-1', {
					digit: '1',
					destinationType: IVROptionDestinationType.QUEUE,
					destinationId: 'queue-1',
				} as never),
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe('validateDestination — ANNOUNCEMENT (via createOption)', () => {
		it('accepts an active recording', async () => {
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => new IVREntity()),
				getSystemRecordingById: jest.fn(async () => ({ status: 'active' })),
			});
			await expect(
				service.createOption(tenantAuth, 'ivr-1', {
					digit: '2',
					destinationType: IVROptionDestinationType.ANNOUNCEMENT,
					destinationId: 'rec-1',
				} as never),
			).resolves.toBeDefined();
		});

		it('rejects a non-active recording', async () => {
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => new IVREntity()),
				getSystemRecordingById: jest.fn(async () => ({ status: 'pending' })),
			});
			await expect(
				service.createOption(tenantAuth, 'ivr-1', {
					digit: '2',
					destinationType: IVROptionDestinationType.ANNOUNCEMENT,
					destinationId: 'rec-1',
				} as never),
			).rejects.toBeInstanceOf(BadRequestException);
		});
	});

	describe('validateDestination — IVR (disabled-IVR guard)', () => {
		it('rejects routing to a disabled IVR', async () => {
			const disabledTarget = new IVREntity();
			disabledTarget.id = 'ivr-2';
			disabledTarget.enabled = false;
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async (id: string) =>
					id === 'ivr-1'
						? Object.assign(new IVREntity(), { id: 'ivr-1', enabled: true })
						: disabledTarget,
				),
			});
			await expect(
				service.createOption(tenantAuth, 'ivr-1', {
					digit: '3',
					destinationType: IVROptionDestinationType.IVR,
					destinationId: 'ivr-2',
				} as never),
			).rejects.toBeInstanceOf(BadRequestException);
		});

		it('rejects self-reference', async () => {
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () =>
					Object.assign(new IVREntity(), { id: 'ivr-1', enabled: true }),
				),
			});
			await expect(
				service.createOption(tenantAuth, 'ivr-1', {
					digit: '3',
					destinationType: IVROptionDestinationType.IVR,
					destinationId: 'ivr-1',
				} as never),
			).rejects.toBeInstanceOf(BadRequestException);
		});
	});

	describe('final-timeout destination validation', () => {
		it('defaults to hangup and requires no destination fields when omitted', async () => {
			const { service, queuesService } = buildService();
			await service.createIvr(tenantAuth, { name: 'Main Menu' } as never);
			expect(queuesService.getEnabledQueueForTenant).not.toHaveBeenCalled();
		});

		it('validates a queue final-timeout destination on create', async () => {
			const getEnabledQueueForTenant = jest.fn(async () => ({ id: 'queue-1' }));
			const { service } = buildService({ getEnabledQueueForTenant });
			const ivr = await service.createIvr(tenantAuth, {
				name: 'Main Menu',
				finalTimeoutDestinationType: IVROptionDestinationType.QUEUE,
				finalTimeoutDestinationId: 'queue-1',
			} as never);
			expect(getEnabledQueueForTenant).toHaveBeenCalledWith('tenant-1', 'queue-1');
			expect(ivr.finalTimeoutDestinationId).toBe('queue-1');
		});

		it('re-validates final-timeout destination on update', async () => {
			const existing = Object.assign(new IVREntity(), {
				id: 'ivr-1',
				finalTimeoutDestinationType: IVROptionDestinationType.HANGUP,
			});
			const getExtensionsByTenantId = jest.fn(async () => [{ id: 'ext-1' }]);
			const { service } = buildService({
				getByIdAndTenantId: jest.fn(async () => existing),
				getExtensionsByTenantId,
			});
			const updated = await service.updateIvr(tenantAuth, 'ivr-1', {
				finalTimeoutDestinationType: IVROptionDestinationType.EXTENSION,
				finalTimeoutDestinationId: 'ext-1',
			} as never);
			expect(getExtensionsByTenantId).toHaveBeenCalledWith('tenant-1');
			expect(updated.finalTimeoutDestinationId).toBe('ext-1');
		});
	});
});
