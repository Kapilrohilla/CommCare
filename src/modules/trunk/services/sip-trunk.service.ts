import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AsteriskProvisioningService } from 'src/modules/pbx/services/asterisk-provisioning.service';
import { PjsipRealtimeRepository } from 'src/modules/pbx/repositories/pjsip-realtime.repository';
import { AuthContext } from 'src/shared/types/auth.types';
import { SipTrunkAuthMode } from '../constants/sip-trunk.constant';
import {
	CreateSipTrunkDto,
	UpdateSipTrunkDto,
} from '../dto/sip-trunk.dto';
import { SipTrunkIdentifyIp } from '../entity/sip-trunk-identify-ip.entity';
import { SipTrunk } from '../entity/sip-trunk.entity';
import { SipTrunkRepository } from '../repositories/sip-trunk.repository';

@Injectable()
export class SipTrunkService {
	private readonly logger = new Logger(SipTrunkService.name);

	constructor(
		private readonly sipTrunkRepository: SipTrunkRepository,
		private readonly asteriskProvisioningService: AsteriskProvisioningService,
	) {}

	async createTrunk(auth: AuthContext, dto: CreateSipTrunkDto): Promise<SipTrunk> {
		const tenantId = this.requireTenant(auth);
		this.assertAuthFields(dto.authMode, dto);

		const id = randomUUID();
		const trunk = new SipTrunk();
		trunk.id = id;
		trunk.tenantId = tenantId;
		trunk.name = dto.name;
		trunk.authMode = dto.authMode;
		trunk.username =
			dto.authMode === SipTrunkAuthMode.Credentials ? (dto.username ?? null) : null;
		trunk.password =
			dto.authMode === SipTrunkAuthMode.Credentials ? (dto.password ?? null) : null;
		trunk.enabled = dto.enabled ?? true;
		trunk.pjsipEndpointId = PjsipRealtimeRepository.trunkEndpointId(id);
		trunk.identifyIps = (dto.identifyIps ?? []).map((match) => {
			const row = new SipTrunkIdentifyIp();
			row.match = match;
			return row;
		});

		const saved = await this.sipTrunkRepository.create(trunk);
		await this.syncAsterisk(saved);
		return saved;
	}

	async getTrunksByTenant(auth: AuthContext): Promise<SipTrunk[]> {
		return this.sipTrunkRepository.getByTenantId(this.requireTenant(auth));
	}

	async getTrunkById(auth: AuthContext, id: string): Promise<SipTrunk> {
		return this.getTrunkForTenant(auth, id);
	}

	async updateTrunk(
		auth: AuthContext,
		id: string,
		dto: UpdateSipTrunkDto,
	): Promise<SipTrunk> {
		const trunk = await this.getTrunkForTenant(auth, id);

		if (dto.name !== undefined) {
			trunk.name = dto.name;
		}
		if (dto.authMode !== undefined) {
			trunk.authMode = dto.authMode;
		}
		if (dto.enabled !== undefined) {
			trunk.enabled = dto.enabled;
		}
		if (dto.username !== undefined) {
			trunk.username = dto.username;
		}
		if (dto.password !== undefined) {
			trunk.password = dto.password;
		}
		if (dto.identifyIps !== undefined) {
			trunk.identifyIps = dto.identifyIps.map((match) => {
				const row = new SipTrunkIdentifyIp();
				row.trunkId = trunk.id;
				row.match = match;
				return row;
			});
		}

		if (trunk.authMode === SipTrunkAuthMode.Ip) {
			trunk.username = null;
			trunk.password = null;
		}

		this.assertAuthFields(trunk.authMode, {
			username: trunk.username,
			password: trunk.password,
			identifyIps: (trunk.identifyIps ?? []).map((row) => row.match),
		});

		const saved = await this.sipTrunkRepository.save(trunk);
		await this.syncAsterisk(saved);
		return saved;
	}

	async deleteTrunk(auth: AuthContext, id: string): Promise<void> {
		const trunk = await this.getTrunkForTenant(auth, id);
		await this.asteriskProvisioningService.deleteTrunk(
			trunk.pjsipEndpointId,
			trunk.id,
		);
		await this.sipTrunkRepository.delete(trunk.id);
	}

	async syncTrunkAsterisk(auth: AuthContext, id: string): Promise<SipTrunk> {
		const trunk = await this.getTrunkForTenant(auth, id);
		await this.syncAsterisk(trunk);
		return trunk;
	}

	private async syncAsterisk(trunk: SipTrunk): Promise<void> {
		const matches = (trunk.identifyIps ?? []).map((row) => row.match);
		try {
			await this.asteriskProvisioningService.provisionTrunk(trunk.id, {
				endpointId: trunk.pjsipEndpointId,
				authMode: trunk.authMode,
				username: trunk.username,
				password: trunk.password,
				identifyMatches: matches,
				enabled: trunk.enabled,
			});
		} catch (error) {
			this.logger.error(
				`Failed to sync trunk ${trunk.id} to Asterisk: ${
					error instanceof Error ? error.message : error
				}`,
			);
			throw error;
		}
	}

	private async getTrunkForTenant(
		auth: AuthContext,
		id: string,
	): Promise<SipTrunk> {
		const tenantId = this.requireTenant(auth);
		const trunk = await this.sipTrunkRepository.getByIdAndTenantId(id, tenantId);
		if (!trunk) {
			throw new NotFoundException('SIP trunk not found');
		}
		return trunk;
	}

	private assertAuthFields(
		authMode: SipTrunkAuthMode,
		fields: {
			username?: string | null;
			password?: string | null;
			identifyIps?: string[];
		},
	): void {
		if (authMode === SipTrunkAuthMode.Ip) {
			if (!fields.identifyIps?.length) {
				throw new BadRequestException('identifyIps is required for ip auth mode');
			}
			return;
		}

		if (!fields.username?.trim() || !fields.password?.trim()) {
			throw new BadRequestException(
				'username and password are required for credentials auth mode',
			);
		}
	}

	private requireTenant(auth: AuthContext): string {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}
		return auth.tenantId;
	}
}
