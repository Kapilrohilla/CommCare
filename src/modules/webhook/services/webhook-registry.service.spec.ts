import { ConflictException, NotFoundException } from '@nestjs/common';
import { WebhookRegistryStatus } from '../constants/webhook.constant';
import { WebhookRegistryService } from './webhook-registry.service';

describe('WebhookRegistryService lifecycle', () => {
	const auth = { tenantId: 'tenant-1', userId: 'user-1' } as never;

	function build(found: { id: string; status: WebhookRegistryStatus } | null) {
		const repo = {
			getWebhookRegistryByIdAndTenantId: jest.fn(async () => found),
			updateWebhookRegistryStatus: jest.fn(async () => undefined),
			deleteWebhookRegistry: jest.fn(async () => undefined),
		};
		const service = new WebhookRegistryService(repo as never);
		return { service, repo };
	}

	describe('disableWebhookRegistry', () => {
		it('sets an active webhook to inactive and records updatedBy', async () => {
			const { service, repo } = build({ id: 'w1', status: WebhookRegistryStatus.ACTIVE });
			const result = await service.disableWebhookRegistry('w1', auth);
			expect(repo.getWebhookRegistryByIdAndTenantId).toHaveBeenCalledWith('w1', 'tenant-1');
			expect(repo.updateWebhookRegistryStatus).toHaveBeenCalledWith('w1', WebhookRegistryStatus.INACTIVE, 'user-1');
			expect(result.status).toBe(WebhookRegistryStatus.INACTIVE);
			expect((result as never as { updatedBy: string }).updatedBy).toBe('user-1');
		});

		it('is a no-op success when already inactive', async () => {
			const { service, repo } = build({ id: 'w1', status: WebhookRegistryStatus.INACTIVE });
			const result = await service.disableWebhookRegistry('w1', auth);
			expect(repo.updateWebhookRegistryStatus).not.toHaveBeenCalled();
			expect(result.status).toBe(WebhookRegistryStatus.INACTIVE);
		});

		it('throws NotFound for unknown or other-tenant id', async () => {
			const { service, repo } = build(null);
			await expect(service.disableWebhookRegistry('w1', auth)).rejects.toThrow(new NotFoundException('Webhook registry not found'));
			expect(repo.updateWebhookRegistryStatus).not.toHaveBeenCalled();
		});
	});

	describe('enableWebhookRegistry', () => {
		it('sets an inactive webhook to active and records updatedBy', async () => {
			const { service, repo } = build({ id: 'w1', status: WebhookRegistryStatus.INACTIVE });
			const result = await service.enableWebhookRegistry('w1', auth);
			expect(repo.updateWebhookRegistryStatus).toHaveBeenCalledWith('w1', WebhookRegistryStatus.ACTIVE, 'user-1');
			expect(result.status).toBe(WebhookRegistryStatus.ACTIVE);
		});

		it('is a no-op success when already active', async () => {
			const { service, repo } = build({ id: 'w1', status: WebhookRegistryStatus.ACTIVE });
			const result = await service.enableWebhookRegistry('w1', auth);
			expect(repo.updateWebhookRegistryStatus).not.toHaveBeenCalled();
			expect(result.status).toBe(WebhookRegistryStatus.ACTIVE);
		});

		it('rejects a blocked webhook with Conflict and leaves it unchanged', async () => {
			const { service, repo } = build({ id: 'w1', status: WebhookRegistryStatus.BLOCKED });
			await expect(service.enableWebhookRegistry('w1', auth)).rejects.toBeInstanceOf(ConflictException);
			expect(repo.updateWebhookRegistryStatus).not.toHaveBeenCalled();
		});

		it('throws NotFound for unknown or other-tenant id', async () => {
			const { service } = build(null);
			await expect(service.enableWebhookRegistry('w1', auth)).rejects.toThrow(new NotFoundException('Webhook registry not found'));
		});
	});

	describe('deleteWebhookRegistry', () => {
		it('deletes a webhook of the tenant via the registry repository only', async () => {
			const { service, repo } = build({ id: 'w1', status: WebhookRegistryStatus.ACTIVE });
			await service.deleteWebhookRegistry('w1', 'tenant-1');
			expect(repo.getWebhookRegistryByIdAndTenantId).toHaveBeenCalledWith('w1', 'tenant-1');
			expect(repo.deleteWebhookRegistry).toHaveBeenCalledWith('w1');
			// 3.4: the service has no logs dependency (WebhookLogs has no FK), so logs are untouched.
			expect(Object.keys(repo).sort()).toEqual(['deleteWebhookRegistry', 'getWebhookRegistryByIdAndTenantId', 'updateWebhookRegistryStatus']);
		});

		it('throws NotFound for unknown or other-tenant id without deleting', async () => {
			const { service, repo } = build(null);
			await expect(service.deleteWebhookRegistry('w1', 'tenant-1')).rejects.toThrow(new NotFoundException('Webhook registry not found'));
			expect(repo.deleteWebhookRegistry).not.toHaveBeenCalled();
		});
	});
});
