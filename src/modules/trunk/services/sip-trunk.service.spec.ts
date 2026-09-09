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
		provisionTrunk?: jest.Mock;
		deleteTrunk?: jest.Mock;
	}) {
		const sipTrunkRepository = {
			create: overrides?.create ?? jest.fn(async (trunk: SipTrunk) => trunk),
			save: overrides?.save ?? jest.fn(async (trunk: SipTrunk) => trunk),
			delete: overrides?.delete ?? jest.fn(async () => undefined),
			getByIdAndTenantId:
				overrides?.getByIdAndTenantId ?? jest.fn(async () => null),
			getByTenantId: jest.fn(async () => []),
		};
		const asteriskProvisioningService = {
			provisionTrunk: overrides?.provisionTrunk ?? jest.fn(async () => undefined),
			deleteTrunk: overrides?.deleteTrunk ?? jest.fn(async () => undefined),
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
		trunk.id = 'trunk-1';
		trunk.tenantId = 'tenant-1';
		trunk.authMode = SipTrunkAuthMode.Ip;
		trunk.enabled = true;
		trunk.pjsipEndpointId = 'trunk-abc';
		trunk.identifyIps = [{ match: '13.52.9.100' } as never];
		const { service, asteriskProvisioningService } = buildService({
			getByIdAndTenantId: jest.fn(async () => trunk),
		});
		await service.syncTrunkAsterisk(tenantAuth, 'trunk-1');
		expect(asteriskProvisioningService.provisionTrunk).toHaveBeenCalledWith(
			'trunk-1',
			expect.objectContaining({
				endpointId: 'trunk-abc',
				identifyMatches: ['13.52.9.100'],
			}),
		);
	});
});
