import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueueStrategy } from '../constants/queue.constant';
import { Queue } from '../entity/queue.entity';

import { QueuesService } from './queues.service';

// got is ESM-only; transitively imported via the webhook dispatcher
jest.mock('got', () => ({ __esModule: true, default: jest.fn() }));

describe('QueuesService', () => {
	const tenantAuth = { tenantId: 'tenant-1', userId: 'user-1' } as never;
	const noTenantAuth = { userId: 'user-1' } as never;

	function buildService(overrides?: {
		existsByNameAndTenant?: jest.Mock;
		getByIdAndTenantId?: jest.Mock;
		existsRouteReferencingDestination?: jest.Mock;
	}) {
		const queueRepository = {
			create: jest.fn(async (queue: Queue) => queue),
			save: jest.fn(async (queue: Queue) => queue),
			delete: jest.fn(),
			getById: jest.fn(),
			getByIdAndTenantId:
				overrides?.getByIdAndTenantId ?? jest.fn(async () => null),
			getByTenantId: jest.fn(async () => []),
			existsByNameAndTenant:
				overrides?.existsByNameAndTenant ?? jest.fn(async () => false),
		};
		const inboundRoutesService = {
			existsRouteReferencingDestination:
				overrides?.existsRouteReferencingDestination ?? jest.fn(async () => false),
		};

		const service = new QueuesService(
			queueRepository as never,
			inboundRoutesService as never,
		);

		return { service, queueRepository, inboundRoutesService };
	}

	it('rejects create without tenant', async () => {
		const { service } = buildService();
		await expect(
			service.createQueue(noTenantAuth, { name: 'Sales' } as never),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('creates a queue with defaults applied', async () => {
		const { service, queueRepository } = buildService();

		const queue = await service.createQueue(tenantAuth, { name: 'Sales' } as never);

		expect(queue.tenantId).toBe('tenant-1');
		expect(queue.strategy).toBe(QueueStrategy.RingAll);
		expect(queue.enabled).toBe(true);
		expect(queueRepository.create).toHaveBeenCalled();
	});

	it('rejects duplicate queue names within a tenant', async () => {
		const { service } = buildService({
			existsByNameAndTenant: jest.fn(async () => true),
		});

		await expect(
			service.createQueue(tenantAuth, { name: 'Sales' } as never),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('rejects ringTimeoutSeconds greater than maxWaitTimeSeconds', async () => {
		const { service } = buildService();

		await expect(
			service.createQueue(tenantAuth, {
				name: 'Sales',
				ringTimeoutSeconds: 60,
				maxWaitTimeSeconds: 30,
			} as never),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('throws NotFoundException when the queue is missing for the tenant', async () => {
		const { service } = buildService();
		await expect(service.getQueueById(tenantAuth, 'missing')).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('blocks deleting a queue still referenced by an inbound route', async () => {
		const queue = Object.assign(new Queue(), {
			id: 'queue-1',
			tenantId: 'tenant-1',
		});
		const { service } = buildService({
			getByIdAndTenantId: jest.fn(async () => queue),
			existsRouteReferencingDestination: jest.fn(async () => true),
		});

		await expect(service.deleteQueue(tenantAuth, 'queue-1')).rejects.toBeInstanceOf(
			ConflictException,
		);
	});

	it('deletes a queue with no referencing routes', async () => {
		const queue = Object.assign(new Queue(), {
			id: 'queue-1',
			tenantId: 'tenant-1',
		});
		const { service, queueRepository } = buildService({
			getByIdAndTenantId: jest.fn(async () => queue),
			existsRouteReferencingDestination: jest.fn(async () => false),
		});

		await service.deleteQueue(tenantAuth, 'queue-1');
		expect(queueRepository.delete).toHaveBeenCalledWith('queue-1');
	});

	it('rejects reading an enabled queue for routing when disabled', async () => {
		const { service } = buildService({
			getByIdAndTenantId: jest.fn(async () =>
				Object.assign(new Queue(), { id: 'queue-1', tenantId: 'tenant-1', enabled: false }),
			),
		});

		await expect(
			service.getEnabledQueueForTenant('tenant-1', 'queue-1'),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
