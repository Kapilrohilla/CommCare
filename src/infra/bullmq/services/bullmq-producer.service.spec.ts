const queueAdd = jest.fn();
const queueGetFailed = jest.fn();
const createdQueueNames: string[] = [];

jest.mock('bullmq', () => ({
	Queue: jest.fn().mockImplementation((name: string) => {
		createdQueueNames.push(name);
		return { name, add: queueAdd, getFailed: queueGetFailed, close: jest.fn() };
	}),
	Job: class {},
}));

jest.mock('ioredis', () =>
	jest.fn().mockImplementation(() => ({ on: jest.fn(), status: 'wait' })),
);

jest.mock('../../../config/env.config', () => ({ env: {} }));
jest.mock('../../redis/redis.config', () => ({ buildRedisOptions: jest.fn(() => ({})) }));

import { BullMQProducerService } from './bullmq-producer.service';

describe('BullMQProducerService (no DLQ)', () => {
	let service: BullMQProducerService;

	beforeEach(() => {
		jest.clearAllMocks();
		createdQueueNames.length = 0;
		queueAdd.mockResolvedValue({ id: 'job-1' });
		service = new BullMQProducerService();
	});

	it('prepareMonitoringQueues creates only event queues and scheduler, no -DLQ queues', () => {
		const queues = service.prepareMonitoringQueues(['evt.a', 'evt.b']);

		expect(queues).toHaveLength(3);
		expect(createdQueueNames).toEqual(['{evt.a}', '{evt.b}', '{scheduler}']);
		expect(createdQueueNames.some((n) => n.includes('-DLQ'))).toBe(false);
	});

	it('does not expose publishEventToDLQ', () => {
		expect((service as unknown as Record<string, unknown>).publishEventToDLQ).toBeUndefined();
	});

	it('enqueues jobs with removeOnFail=false so exhausted jobs stay in the failed set', async () => {
		await service.publishEvent('evt.a', { foo: 1 });

		expect(queueAdd).toHaveBeenCalledTimes(1);
		const opts = queueAdd.mock.calls[0][2];
		expect(opts.removeOnFail).toBe(false);
	});

	it('getFailedJobs reads from the main event queue', async () => {
		queueGetFailed.mockResolvedValue([
			{ id: '1', name: 'evt.a', data: {}, failedReason: 'boom', attemptsMade: 10, timestamp: 1, finishedOn: 2 },
		]);

		const failed = await service.getFailedJobs('evt.a');

		expect(createdQueueNames).toEqual(['{evt.a}']);
		expect(failed).toEqual([
			{ id: '1', name: 'evt.a', data: {}, failedReason: 'boom', attemptsMade: 10, timestamp: 1, finishedOn: 2 },
		]);
	});
});
