import { Injectable } from '@nestjs/common';
import { PostgresqlService } from 'src/infra/database/postgresql/postgresqlService';
import { Extension } from '../entity/extension.entity';
import { PsAor } from '../entity/ps-aor.entity';
import { PsAuth } from '../entity/ps-auth.entity';
import { PsEndpoint } from '../entity/ps-endpoint.entity';
import { PsEndpointIdIp } from '../entity/ps-endpoint-id-ip.entity';
import { PsAorRepository } from './ps-aor.repository';
import { PsAuthRepository } from './ps-auth.repository';
import { PsEndpointRepository } from './ps-endpoint.repository';

export interface PjsipRealtimeRows {
	endpointId: string;
	authId: string;
	aorId: string;
}

export type TrunkAuthMode = 'ip' | 'credentials';

export interface TrunkRealtimeProvisionInput {
	endpointId: string;
	authMode: TrunkAuthMode;
	username?: string | null;
	password?: string | null;
	identifyMatches: string[];
	enabled: boolean;
}

/**
 * PJSIP identity convention (inbound REGISTER):
 * - Endpoint ID = extension number
 * - AOR ID      = extension number (must match SIP To/From username)
 * - Auth ID     = `${extension}-auth`
 *
 * Trunk convention (all ids ≤ 40 chars for Asterisk realtime):
 * - Endpoint ID = `trunk-{uuidWithoutDashes}` (38)
 * - AOR ID      = same as endpoint
 * - Auth ID     = `ta{uuidWithoutDashes}` (34) — credentials mode only
 * - Identify ID = `i{uuidWithoutDashes}{nn}` (35)
 */
@Injectable()
export class PjsipRealtimeRepository {
	constructor(
		private readonly postgresqlService: PostgresqlService,
		private readonly psAuthRepository: PsAuthRepository,
		private readonly psAorRepository: PsAorRepository,
		private readonly psEndpointRepository: PsEndpointRepository,
	) {}

	endpointIds(extensionNumber: string): PjsipRealtimeRows {
		return {
			endpointId: extensionNumber,
			authId: `${extensionNumber}-auth`,
			aorId: extensionNumber,
		};
	}

	static trunkEndpointId(trunkUuid: string): string {
		const compact = trunkUuid.replace(/-/g, '');
		return `trunk-${compact}`.slice(0, 40);
	}

	static trunkAuthId(trunkUuid: string): string {
		const compact = trunkUuid.replace(/-/g, '');
		return `ta${compact}`.slice(0, 40);
	}

	static trunkIdentifyId(trunkUuid: string, index: number): string {
		const compact = trunkUuid.replace(/-/g, '');
		const suffix = String(index).padStart(2, '0');
		return `i${compact}${suffix}`.slice(0, 40);
	}

	async upsertExtension(extension: Extension): Promise<void> {
		const { endpointId, authId, aorId } = this.endpointIds(extension.extension);
		const callerId =
			extension.callerIdName && extension.callerIdNumber
				? `${extension.callerIdName} <${extension.callerIdNumber}>`
				: extension.callerIdName
					? `${extension.callerIdName} <${extension.extension}>`
					: `Extension ${extension.extension} <${extension.extension}>`;

		const auth = new PsAuth();
		auth.id = authId;
		auth.authType = 'userpass';
		auth.username = extension.pjsipUsername;
		auth.password = extension.pjsipPassword;

		const aor = new PsAor();
		aor.id = aorId;
		aor.maxContacts = 3;
		aor.removeExisting = 'yes';

		const endpoint = new PsEndpoint();
		endpoint.id = endpointId;
		endpoint.transport = 'transport-udp';
		endpoint.aors = aorId;
		endpoint.auth = authId;
		endpoint.context = 'from-internal';
		endpoint.disallow = 'all';
		endpoint.allow = 'ulaw,alaw,gsm';
		endpoint.directMedia = 'no';
		endpoint.rtpSymmetric = 'yes';
		endpoint.forceRport = 'yes';
		endpoint.rewriteContact = 'yes';
		endpoint.callerid = callerId;
		endpoint.mediaUseReceivedTransport = 'yes';

		await this.postgresqlService.getWriterDataSource().transaction(async (manager) => {
			await manager.save(PsAuth, auth);
			const existingAor = await manager.findOne(PsAor, { where: { id: aorId } });
			if (!existingAor) {
				await manager.save(PsAor, aor);
			}
			await manager.save(PsEndpoint, endpoint);
		});
	}

	async deleteExtension(extensionNumber: string): Promise<void> {
		const { endpointId, authId, aorId } = this.endpointIds(extensionNumber);

		await this.postgresqlService.getWriterDataSource().transaction(async (manager) => {
			await manager.delete(PsEndpoint, { id: endpointId });
			await manager.delete(PsAuth, { id: authId });
			await manager.delete(PsAor, { id: aorId });
		});
	}

	async upsertTrunk(input: TrunkRealtimeProvisionInput, trunkUuid: string): Promise<void> {
		const endpointId = input.endpointId;
		const aorId = endpointId;
		const authId = PjsipRealtimeRepository.trunkAuthId(trunkUuid);

		await this.postgresqlService.getWriterDataSource().transaction(async (manager) => {
			await manager.delete(PsEndpointIdIp, { endpoint: endpointId });

			if (input.authMode === 'credentials') {
				const auth = new PsAuth();
				auth.id = authId;
				auth.authType = 'userpass';
				auth.username = input.username ?? null;
				auth.password = input.password ?? null;
				await manager.save(PsAuth, auth);
			} else {
				await manager.delete(PsAuth, { id: authId });
			}

			const aor = new PsAor();
			aor.id = aorId;
			aor.maxContacts = 1;
			aor.removeExisting = 'yes';
			await manager.save(PsAor, aor);

			const endpoint = new PsEndpoint();
			endpoint.id = endpointId;
			endpoint.transport = 'transport-udp';
			endpoint.aors = aorId;
			endpoint.auth = input.authMode === 'credentials' ? authId : null;
			endpoint.context = 'from-trunk';
			endpoint.disallow = 'all';
			endpoint.allow = 'ulaw,alaw,gsm';
			endpoint.directMedia = 'no';
			endpoint.rtpSymmetric = 'yes';
			endpoint.forceRport = 'yes';
			endpoint.rewriteContact = 'yes';
			endpoint.callerid = null;
			endpoint.mediaUseReceivedTransport = 'yes';
			await manager.save(PsEndpoint, endpoint);

			if (input.enabled && input.identifyMatches.length > 0) {
				const identifyRows = input.identifyMatches.map((match, index) => {
					const row = new PsEndpointIdIp();
					row.id = PjsipRealtimeRepository.trunkIdentifyId(trunkUuid, index);
					row.endpoint = endpointId;
					row.match = match;
					row.srvLookups = 'yes';
					return row;
				});
				await manager.save(PsEndpointIdIp, identifyRows);
			}
		});
	}

	async deleteTrunk(endpointId: string, trunkUuid: string): Promise<void> {
		const authId = PjsipRealtimeRepository.trunkAuthId(trunkUuid);

		await this.postgresqlService.getWriterDataSource().transaction(async (manager) => {
			await manager.delete(PsEndpointIdIp, { endpoint: endpointId });
			await manager.delete(PsEndpoint, { id: endpointId });
			await manager.delete(PsAuth, { id: authId });
			await manager.delete(PsAor, { id: endpointId });
		});
	}

	async listEndpointIds(): Promise<string[]> {
		return this.psEndpointRepository.listIds();
	}
}
