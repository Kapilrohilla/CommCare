import { WebhookRegistryController } from './webhook-registery.controller';

describe('WebhookRegistryController lifecycle routes', () => {
	const auth = { tenantId: 'tenant-1', userId: 'user-1' } as never;

	function build() {
		const service = {
			disableWebhookRegistry: jest.fn(async () => ({ id: 'w1', status: 'inactive' })),
			enableWebhookRegistry: jest.fn(async () => ({ id: 'w1', status: 'active' })),
			deleteWebhookRegistry: jest.fn(async () => undefined),
		};
		return { controller: new WebhookRegistryController(service as never), service };
	}

	it('PATCH :id/disable passes id and auth to the service', async () => {
		const { controller, service } = build();
		const result = await controller.disableWebhookRegistry('w1', auth);
		expect(service.disableWebhookRegistry).toHaveBeenCalledWith('w1', auth);
		expect(result).toEqual({ id: 'w1', status: 'inactive' });
	});

	it('PATCH :id/enable passes id and auth to the service', async () => {
		const { controller, service } = build();
		const result = await controller.enableWebhookRegistry('w1', auth);
		expect(service.enableWebhookRegistry).toHaveBeenCalledWith('w1', auth);
		expect(result).toEqual({ id: 'w1', status: 'active' });
	});

	it('DELETE :id passes tenantId, returns nothing and is 204', async () => {
		const { controller, service } = build();
		const result = await controller.deleteWebhookRegistry('w1', auth);
		expect(service.deleteWebhookRegistry).toHaveBeenCalledWith('w1', 'tenant-1');
		expect(result).toBeUndefined();
		expect(Reflect.getMetadata('__httpCode__', WebhookRegistryController.prototype.deleteWebhookRegistry)).toBe(204);
	});

	it('maps routes to the expected paths and methods', () => {
		const proto = WebhookRegistryController.prototype;
		// RequestMethod: PATCH = 4, DELETE = 3
		expect(Reflect.getMetadata('path', proto.disableWebhookRegistry)).toBe('/:id/disable');
		expect(Reflect.getMetadata('method', proto.disableWebhookRegistry)).toBe(4);
		expect(Reflect.getMetadata('path', proto.enableWebhookRegistry)).toBe('/:id/enable');
		expect(Reflect.getMetadata('method', proto.enableWebhookRegistry)).toBe(4);
		expect(Reflect.getMetadata('path', proto.deleteWebhookRegistry)).toBe('/:id');
		expect(Reflect.getMetadata('method', proto.deleteWebhookRegistry)).toBe(3);
	});
});
