import got from 'got';
import { WebhookDispatcherService } from './webhook-dispatch.service';
import {
	WebhookRegistryEventTrigger,
	WebhookRegistryMethod,
	WebhookRegistryStatus,
} from '../constants/webhook.constant';
import { WebhookRegistry } from '../entity/webhook.entity';

jest.mock('got', () => ({ __esModule: true, default: jest.fn() }));

const gotMock = got as unknown as jest.Mock;

const buildRegistry = (overrides: Partial<WebhookRegistry> = {}): WebhookRegistry =>
	({
		id: 'wh-1',
		tenantId: 'tenant-1',
		endpoint: 'https://example.com/hook',
		method: WebhookRegistryMethod.POST,
		headers: { 'X-Key': 'a' },
		status: WebhookRegistryStatus.ACTIVE,
		pauseWebhookAt: null,
		...overrides,
	}) as unknown as WebhookRegistry;

const buildBody = () => ({
	event: 'click2call.call.started' as unknown as WebhookRegistryEventTrigger,
	tenantId: 'tenant-1',
	timestamp: new Date().toISOString(),
	data: { callId: 'c1' },
});

describe('WebhookDispatcherService.handleEventWebhookDelivery', () => {
	let service: WebhookDispatcherService;
	let registryService: { getWebhookRegistryById: jest.Mock };
	let logsService: { createWebhookLog: jest.Mock };

	const run = (snapshot: Partial<WebhookRegistry> = {}) =>
		service.handleEventWebhookDelivery(
			'webhook.delivery',
			{
				webhookRegistry: buildRegistry({ ...snapshot }),
				eventTrigger: buildBody().event,
				body: buildBody(),
			},
			0,
		);

	beforeEach(() => {
		gotMock.mockReset();
		gotMock.mockResolvedValue({ statusCode: 200, body: '{"ok":true}' });
		registryService = { getWebhookRegistryById: jest.fn() };
		logsService = { createWebhookLog: jest.fn().mockResolvedValue(undefined) };
		service = new WebhookDispatcherService(
			registryService as any,
			{ publish: jest.fn() } as any,
			logsService as any,
		);
	});

	it('skips when the fresh registry is inactive although snapshot is active', async () => {
		registryService.getWebhookRegistryById.mockResolvedValue(
			buildRegistry({ status: WebhookRegistryStatus.INACTIVE }),
		);
		await run();
		expect(registryService.getWebhookRegistryById).toHaveBeenCalledWith('wh-1');
		expect(gotMock).not.toHaveBeenCalled();
		expect(logsService.createWebhookLog).not.toHaveBeenCalled();
	});

	it('skips when the fresh registry is blocked', async () => {
		registryService.getWebhookRegistryById.mockResolvedValue(
			buildRegistry({ status: WebhookRegistryStatus.BLOCKED }),
		);
		await run();
		expect(gotMock).not.toHaveBeenCalled();
	});

	it('skips when the fresh registry is paused (Date)', async () => {
		registryService.getWebhookRegistryById.mockResolvedValue(
			buildRegistry({ pauseWebhookAt: new Date(Date.now() + 60_000) }),
		);
		await run();
		expect(gotMock).not.toHaveBeenCalled();
	});

	it('skips when the fresh registry is paused (ISO string)', async () => {
		registryService.getWebhookRegistryById.mockResolvedValue(
			buildRegistry({
				pauseWebhookAt: new Date(Date.now() + 60_000).toISOString() as unknown as Date,
			}),
		);
		await run();
		expect(gotMock).not.toHaveBeenCalled();
	});

	it('delivers when pauseWebhookAt is in the past (ISO string)', async () => {
		registryService.getWebhookRegistryById.mockResolvedValue(
			buildRegistry({
				pauseWebhookAt: new Date(Date.now() - 60_000).toISOString() as unknown as Date,
			}),
		);
		await run();
		expect(gotMock).toHaveBeenCalledTimes(1);
	});

	it('ends without throwing or HTTP when the registry is missing', async () => {
		registryService.getWebhookRegistryById.mockResolvedValue(null);
		await expect(run()).resolves.toBeUndefined();
		expect(gotMock).not.toHaveBeenCalled();
		expect(logsService.createWebhookLog).not.toHaveBeenCalled();
	});

	it('delivers when snapshot was inactive but webhook was re-enabled', async () => {
		registryService.getWebhookRegistryById.mockResolvedValue(buildRegistry());
		await run({ status: WebhookRegistryStatus.INACTIVE });
		expect(gotMock).toHaveBeenCalledTimes(1);
		expect(logsService.createWebhookLog).toHaveBeenCalledTimes(1);
	});

	it('uses the fresh endpoint, method and headers for the call and log', async () => {
		registryService.getWebhookRegistryById.mockResolvedValue(
			buildRegistry({
				endpoint: 'https://new.example.com/h',
				method: WebhookRegistryMethod.PUT,
				headers: { 'X-New': 'b' },
			}),
		);
		await run();
		const [url, options] = gotMock.mock.calls[0];
		expect(url).toBe('https://new.example.com/h');
		expect(options.method).toBe(WebhookRegistryMethod.PUT);
		expect(options.headers).toEqual({
			'Content-Type': 'application/json',
			'X-New': 'b',
		});
		const log = logsService.createWebhookLog.mock.calls[0][0];
		expect(log.requestEndpoint).toBe('https://new.example.com/h');
		expect(log.requestMethod).toBe(WebhookRegistryMethod.PUT);
		expect(log.requestHeaders).toEqual({ 'X-New': 'b' });
	});

	it('logs then throws on non-2xx responses', async () => {
		registryService.getWebhookRegistryById.mockResolvedValue(buildRegistry());
		gotMock.mockResolvedValue({ statusCode: 500, body: 'boom' });
		await expect(run()).rejects.toThrow('returned HTTP 500');
		expect(logsService.createWebhookLog).toHaveBeenCalledTimes(1);
	});

	it('still skips invalid payloads', async () => {
		await service.handleEventWebhookDelivery('webhook.delivery', {}, 0);
		expect(registryService.getWebhookRegistryById).not.toHaveBeenCalled();
		expect(gotMock).not.toHaveBeenCalled();
	});
});

describe('WebhookDispatcherService.handleEventWebhookFanout', () => {
	let service: WebhookDispatcherService;
	let registryService: { getActiveWebhookRegistriesByEventTrigger: jest.Mock };
	let producer: { publish: jest.Mock };

	const trigger = 'systemRecording.processed' as unknown as WebhookRegistryEventTrigger;
	const fanout = {
		eventTrigger: trigger,
		tenantId: 'tenant-1',
		data: { recordingId: 'rec-1' },
	};

	beforeEach(() => {
		registryService = {
			getActiveWebhookRegistriesByEventTrigger: jest.fn(),
		};
		producer = { publish: jest.fn().mockResolvedValue(undefined) };
		service = new WebhookDispatcherService(
			registryService as any,
			producer as any,
			{ createWebhookLog: jest.fn() } as any,
		);
	});

	it('enqueues one delivery per registry returned for the trigger and tenant', async () => {
		registryService.getActiveWebhookRegistriesByEventTrigger.mockResolvedValue([
			buildRegistry({ id: 'wh-1' }),
			buildRegistry({ id: 'wh-2' }),
		]);
		await service.handleEventWebhookFanout('webhook.fanout', fanout, 0);
		expect(
			registryService.getActiveWebhookRegistriesByEventTrigger,
		).toHaveBeenCalledWith(trigger, 'tenant-1');
		expect(producer.publish).toHaveBeenCalledTimes(2);
		const ids = producer.publish.mock.calls.map((c) => c[1].webhookRegistry.id);
		expect(ids).toEqual(['wh-1', 'wh-2']);
		expect(producer.publish.mock.calls[0][1].body.tenantId).toBe('tenant-1');
		expect(producer.publish.mock.calls[0][1].body.data).toEqual({ recordingId: 'rec-1' });
	});

	it('enqueues nothing when no registries match', async () => {
		registryService.getActiveWebhookRegistriesByEventTrigger.mockResolvedValue([]);
		await service.handleEventWebhookFanout('webhook.fanout', fanout, 0);
		expect(producer.publish).not.toHaveBeenCalled();
	});
});
