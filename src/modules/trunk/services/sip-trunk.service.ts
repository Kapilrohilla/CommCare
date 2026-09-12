import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AsteriskProvisioningService } from 'src/modules/pbx/services/asterisk-provisioning.service';
import {
	PJSIP_ID_MAX_LENGTH,
	PjsipRealtimeRepository,
} from 'src/modules/pbx/repositories/pjsip-realtime.repository';
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
			dto.authMode === SipTrunkAuthMode.Credentials
				? (dto.username?.trim() ?? null)
				: null;
		trunk.password =
			dto.authMode === SipTrunkAuthMode.Credentials ? (dto.password ?? null) : null;
		trunk.enabled = dto.enabled ?? true;
		trunk.pjsipEndpointId = this.resolveEndpointId(trunk.authMode, id, trunk.username);
		trunk.identifyIps = (dto.identifyIps ?? []).map((match) => {
			const row = new SipTrunkIdentifyIp();
			row.match = match;
			return row;
		});

		await this.assertEndpointIdentityAvailable(trunk.pjsipEndpointId, null);

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
		const previousEndpointId = trunk.pjsipEndpointId;

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
			trunk.username = dto.username?.trim() ?? null;
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
		} else if (trunk.username) {
			trunk.username = trunk.username.trim();
		}

		this.assertAuthFields(trunk.authMode, {
			username: trunk.username,
			password: trunk.password,
			identifyIps: (trunk.identifyIps ?? []).map((row) => row.match),
		});

		trunk.pjsipEndpointId = this.resolveEndpointId(
			trunk.authMode,
			trunk.id,
			trunk.username,
		);

		await this.assertEndpointIdentityAvailable(trunk.pjsipEndpointId, trunk.id);

		const saved = await this.sipTrunkRepository.save(trunk);
		await this.syncAsterisk(
			saved,
			previousEndpointId !== saved.pjsipEndpointId ? previousEndpointId : undefined,
		);
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
		const previousEndpointId = trunk.pjsipEndpointId;
		trunk.pjsipEndpointId = this.resolveEndpointId(
			trunk.authMode,
			trunk.id,
			trunk.username,
		);
		if (trunk.pjsipEndpointId !== previousEndpointId) {
			await this.assertEndpointIdentityAvailable(trunk.pjsipEndpointId, trunk.id);
			await this.sipTrunkRepository.save(trunk);
		}
		await this.syncAsterisk(
			trunk,
			previousEndpointId !== trunk.pjsipEndpointId ? previousEndpointId : undefined,
		);
		return trunk;
	}

	private async syncAsterisk(
		trunk: SipTrunk,
		previousEndpointId?: string,
	): Promise<void> {
		const matches = (trunk.identifyIps ?? []).map((row) => row.match);
		try {
			await this.asteriskProvisioningService.provisionTrunk(trunk.id, {
				endpointId: trunk.pjsipEndpointId,
				authMode: trunk.authMode,
				username: trunk.username,
				password: trunk.password,
				identifyMatches: matches,
				enabled: trunk.enabled,
				previousEndpointId,
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

	private resolveEndpointId(
		authMode: SipTrunkAuthMode,
		trunkUuid: string,
		username: string | null,
	): string {
		if (authMode === SipTrunkAuthMode.Credentials) {
			const trimmed = username?.trim() ?? '';
			if (!trimmed) {
				throw new BadRequestException(
					'username is required for credentials auth mode',
				);
			}
			if (trimmed.length > PJSIP_ID_MAX_LENGTH) {
				throw new BadRequestException(
					`username must be at most ${PJSIP_ID_MAX_LENGTH} characters`,
				);
			}
			return trimmed;
		}
		return PjsipRealtimeRepository.trunkEndpointId(trunkUuid);
	}

	private async assertEndpointIdentityAvailable(
		endpointId: string,
		excludeTrunkId: string | null,
	): Promise<void> {
		const byEndpoint = await this.sipTrunkRepository.findByPjsipEndpointId(endpointId);
		if (byEndpoint && byEndpoint.id !== excludeTrunkId) {
			throw new BadRequestException(
				`PJSIP endpoint id '${endpointId}' is already used by another trunk`,
			);
		}

		const byUsername = await this.sipTrunkRepository.findByUsername(endpointId);
		if (byUsername && byUsername.id !== excludeTrunkId) {
			throw new BadRequestException(
				`SIP username '${endpointId}' is already used by another trunk`,
			);
		}

		const existsInAsterisk =
			await this.asteriskProvisioningService.endpointIdExists(endpointId);
		if (!existsInAsterisk) {
			return;
		}

		// Allow re-provisioning when this trunk already owns the endpoint id.
		if (excludeTrunkId && byEndpoint?.id === excludeTrunkId) {
			return;
		}

		throw new BadRequestException(
			`PJSIP endpoint id '${endpointId}' is already provisioned in Asterisk`,
		);
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

		const username = fields.username?.trim() ?? '';
		if (!username || !fields.password?.trim()) {
			throw new BadRequestException(
				'username and password are required for credentials auth mode',
			);
		}
		if (username.length > PJSIP_ID_MAX_LENGTH) {
			throw new BadRequestException(
				`username must be at most ${PJSIP_ID_MAX_LENGTH} characters`,
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
