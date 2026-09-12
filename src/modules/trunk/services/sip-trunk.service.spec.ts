import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SipTrunkAuthMode } from '../constants/sip-trunk.constant';
import { SipTrunk } from '../entity/sip-trunk.entity';
import { SipTrunkService } from './sip-trunk.service';

describe('SipTrunkService', () => {
	const tenantAuth = { tenantId: 'tenant-1' } as never;
	const otherAuth = { tenantId: 'tenant-2' } as never;

	function buildService(overrides?: {
		getByIdAndTenantId?: jest.Mock;
		create?: jest.Mock;
		save?: jest.Mock;
		delete?: jest.Mock;
		findByUsername?: jest.Mock;
		findByPjsipEndpointId?: jest.Mock;
		provisionTrunk?: jest.Mock;
		deleteTrunk?: jest.Mock;
		endpointIdExists?: jest.Mock;
	}) {
		const sipTrunkRepository = {
			create: overrides?.create ?? jest.fn(async (trunk: SipTrunk) => trunk),
			save: overrides?.save ?? jest.fn(async (trunk: SipTrunk) => trunk),
			delete: overrides?.delete ?? jest.fn(async () => undefined),
			getByIdAndTenantId:
				overrides?.getByIdAndTenantId ?? jest.fn(async () => null),
			getByTenantId: jest.fn(async () => []),
			findByUsername: overrides?.findByUsername ?? jest.fn(async () => null),
			findByPjsipEndpointId:
				overrides?.findByPjsipEndpointId ?? jest.fn(async () => null),
		};
		const asteriskProvisioningService = {
			provisionTrunk: overrides?.provisionTrunk ?? jest.fn(async () => undefined),
			deleteTrunk: overrides?.deleteTrunk ?? jest.fn(async () => undefined),
			endpointIdExists: overrides?.endpointIdExists ?? jest.fn(async () => false),
		};
		return {
			service: new SipTrunkService(
				sipTrunkRepository as never,
				asteriskProvisioningService as never,
			),
			sipTrunkRepository,
			asteriskProvisioningService,
		};
	}

	it('rejects ip trunks with empty identify list', async () => {
		const { service } = buildService();
		await expect(
			service.createTrunk(tenantAuth, {
				name: 'plivo',
				authMode: SipTrunkAuthMode.Ip,
				identifyIps: [],
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('creates ip trunk and syncs asterisk', async () => {
		const { service, asteriskProvisioningService } = buildService();
		const trunk = await service.createTrunk(tenantAuth, {
			name: 'plivo',
			authMode: SipTrunkAuthMode.Ip,
			identifyIps: ['13.52.9.100'],
		});
		expect(trunk.pjsipEndpointId.startsWith('trunk-')).toBe(true);
		expect(asteriskProvisioningService.provisionTrunk).toHaveBeenCalled();
	});

	it('creates credentials trunk with endpoint id equal to username', async () => {
		const { service, asteriskProvisioningService } = buildService();
		const trunk = await service.createTrunk(tenantAuth, {
			name: 'digest-trunk',
			authMode: SipTrunkAuthMode.Credentials,
			username: 'carrier-trunk',
			password: 's3cret',
		});
		expect(trunk.pjsipEndpointId).toBe('carrier-trunk');
		expect(asteriskProvisioningService.provisionTrunk).toHaveBeenCalledWith(
			trunk.id,
			expect.objectContaining({
				endpointId: 'carrier-trunk',
				authMode: SipTrunkAuthMode.Credentials,
				username: 'carrier-trunk',
			}),
		);
	});

	it('allows credentials trunk with empty identifyIps', async () => {
		const { service } = buildService();
		const trunk = await service.createTrunk(tenantAuth, {
			name: 'digest-trunk',
			authMode: SipTrunkAuthMode.Credentials,
			username: 'carrier-trunk',
			password: 's3cret',
			identifyIps: [],
		});
		expect(trunk.pjsipEndpointId).toBe('carrier-trunk');
	});

	it('rejects credentials trunk without password', async () => {
		const { service } = buildService();
		await expect(
			service.createTrunk(tenantAuth, {
				name: 'digest-trunk',
				authMode: SipTrunkAuthMode.Credentials,
				username: 'carrier-trunk',
				password: '',
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects credentials username longer than 40 chars', async () => {
		const { service } = buildService();
		await expect(
			service.createTrunk(tenantAuth, {
				name: 'digest-trunk',
				authMode: SipTrunkAuthMode.Credentials,
				username: 'x'.repeat(41),
				password: 's3cret',
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects credentials username that collides with Asterisk endpoint', async () => {
		const { service } = buildService({
			endpointIdExists: jest.fn(async () => true),
		});
		await expect(
			service.createTrunk(tenantAuth, {
				name: 'digest-trunk',
				authMode: SipTrunkAuthMode.Credentials,
				username: '101',
				password: 's3cret',
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('denies cross-tenant get', async () => {
		const trunk = new SipTrunk();
		trunk.id = 'trunk-1';
		trunk.tenantId = 'tenant-1';
		const { service } = buildService({
			getByIdAndTenantId: jest.fn(async (_id: string, tenantId: string) =>
				tenantId === 'tenant-1' ? trunk : null,
			),
		});
		await expect(service.getTrunkById(otherAuth, 'trunk-1')).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('requires tenant on create', async () => {
		const { service } = buildService();
		await expect(
			service.createTrunk({} as never, {
				name: 'plivo',
				authMode: SipTrunkAuthMode.Ip,
				identifyIps: ['1.1.1.1'],
			}),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('delete removes asterisk rows then trunk', async () => {
		const trunk = new SipTrunk();
		trunk.id = 'trunk-1';
		trunk.tenantId = 'tenant-1';
		trunk.pjsipEndpointId = 'trunk-abc';
		const { service, asteriskProvisioningService, sipTrunkRepository } = buildService({
			getByIdAndTenantId: jest.fn(async () => trunk),
		});
		await service.deleteTrunk(tenantAuth, 'trunk-1');
		expect(asteriskProvisioningService.deleteTrunk).toHaveBeenCalledWith(
			'trunk-abc',
			'trunk-1',
		);
		expect(sipTrunkRepository.delete).toHaveBeenCalledWith('trunk-1');
	});

	it('sync-asterisk repair re-provisions existing trunk', async () => {
		const trunk = new SipTrunk();
		trunk.id = '550e8400-e29b-41d4-a716-446655440000';
		trunk.tenantId = 'tenant-1';
		trunk.authMode = SipTrunkAuthMode.Ip;
		trunk.enabled = true;
		trunk.pjsipEndpointId = 'trunk-550e8400e29b41d4a716446655440000';
		trunk.identifyIps = [{ match: '13.52.9.100' } as never];
		const { service, asteriskProvisioningService } = buildService({
			getByIdAndTenantId: jest.fn(async () => trunk),
		});
		await service.syncTrunkAsterisk(tenantAuth, trunk.id);
		expect(asteriskProvisioningService.provisionTrunk).toHaveBeenCalledWith(
			trunk.id,
			expect.objectContaining({
				endpointId: 'trunk-550e8400e29b41d4a716446655440000',
				identifyMatches: ['13.52.9.100'],
			}),
		);
	});

	it('sync-asterisk migrates legacy credentials endpoint id to username', async () => {
		const trunk = new SipTrunk();
		trunk.id = '550e8400-e29b-41d4-a716-446655440000';
		trunk.tenantId = 'tenant-1';
		trunk.authMode = SipTrunkAuthMode.Credentials;
		trunk.username = 'carrier-trunk';
		trunk.password = 's3cret';
		trunk.enabled = true;
		trunk.pjsipEndpointId = 'trunk-550e8400e29b41d4a716446655440000';
		trunk.identifyIps = [];
		const { service, asteriskProvisioningService, sipTrunkRepository } = buildService({
			getByIdAndTenantId: jest.fn(async () => trunk),
		});
		await service.syncTrunkAsterisk(tenantAuth, trunk.id);
		expect(sipTrunkRepository.save).toHaveBeenCalled();
		expect(asteriskProvisioningService.provisionTrunk).toHaveBeenCalledWith(
			trunk.id,
			expect.objectContaining({
				endpointId: 'carrier-trunk',
				previousEndpointId: 'trunk-550e8400e29b41d4a716446655440000',
			}),
		);
	});
});
