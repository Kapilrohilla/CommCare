import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CallDirection, CallStatus } from '../constants/call.constant';
import { CallEntity } from '../entity/calls.entity';

jest.mock('src/modules/pbx/services/asterisk.service', () => ({
	AsteriskService: class AsteriskService {},
}));
jest.mock('src/infra/queue/services/event-producer.service', () => ({
	EventProducer: class EventProducer {},
}));
jest.mock('./call-legs.service', () => ({
	CallLegsService: class CallLegsService {},
}));
jest.mock('./call-events.service', () => ({
	CallEventsService: class CallEventsService {},
}));

import { CallsService } from './calls.service';

describe('CallsService tenant reads', () => {
	const tenantAuth = { tenantId: 'tenant-1', userId: 'user-1' } as never;
	const noTenantAuth = { userId: 'user-1' } as never;

	function buildService(overrides?: {
		findByTenantId?: jest.Mock;
		findByIdAndTenantId?: jest.Mock;
		getDashboardStats?: jest.Mock;
		getExtensionsByTenantId?: jest.Mock;
	}) {
		const callsRepository = {
			getCalls: jest.fn(),
			getCallById: jest.fn(),
			findByLinkedId: jest.fn(),
			createCall: jest.fn(),
			updateCall: jest.fn(),
			deleteCall: jest.fn(),
			findByTenantId:
				overrides?.findByTenantId ??
				jest.fn(async () => ({ items: [], total: 0 })),
			findByIdAndTenantId:
				overrides?.findByIdAndTenantId ?? jest.fn(async () => null),
			getDashboardStats:
				overrides?.getDashboardStats ??
				jest.fn(async () => ({
					callsToday: 0,
					talkTimeSeconds: 0,
					missedCalls: 0,
					byStatus: [],
				})),
		};
		const extensionService = {
			getExtensionsByTenantId:
				overrides?.getExtensionsByTenantId ?? jest.fn(async () => []),
			getExtensionByNumber: jest.fn(),
		};
		const service = new CallsService(
			callsRepository as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			extensionService as never,
		);
		return { service, callsRepository, extensionService };
	}

	it('rejects list without tenant', async () => {
		const { service } = buildService();
		await expect(
			service.listCallsForTenant(noTenantAuth, { limit: 10, offset: 0 }),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('lists calls for tenant', async () => {
		const call = { id: 'call-1', tenantId: 'tenant-1' } as CallEntity;
		const { service, callsRepository } = buildService({
			findByTenantId: jest.fn(async () => ({ items: [call], total: 1 })),
		});
		const result = await service.listCallsForTenant(tenantAuth, {
			limit: 20,
			offset: 0,
			direction: CallDirection.INBOUND,
		});
		expect(result.total).toBe(1);
		expect(callsRepository.findByTenantId).toHaveBeenCalledWith(
			'tenant-1',
			expect.objectContaining({
				direction: CallDirection.INBOUND,
				limit: 20,
			}),
		);
	});

	it('returns 404 for cross-tenant call detail', async () => {
		const { service } = buildService({
			findByIdAndTenantId: jest.fn(async () => null),
		});
		await expect(
			service.getCallForTenant(tenantAuth, 'other-call'),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('builds dashboard with extension counts', async () => {
		const { service } = buildService({
			getDashboardStats: jest.fn(async () => ({
				callsToday: 2,
				talkTimeSeconds: 90,
				missedCalls: 1,
				byStatus: [{ status: CallStatus.COMPLETED, count: '2' }],
			})),
			getExtensionsByTenantId: jest.fn(async () => [
				{ userId: 'u1' },
				{ userId: null },
			]),
			findByTenantId: jest.fn(async () => ({ items: [], total: 0 })),
		});
		const dashboard = await service.getDashboardForTenant(tenantAuth);
		expect(dashboard.callsToday.total).toBe(2);
		expect(dashboard.talkTimeSeconds).toBe(90);
		expect(dashboard.extensions).toEqual({ assigned: 1, total: 2 });
	});
});
