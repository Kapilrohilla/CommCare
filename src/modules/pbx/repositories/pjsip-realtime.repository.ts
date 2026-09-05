import { Injectable } from '@nestjs/common';
import { PostgresqlService } from 'src/infra/database/postgresql/postgresqlService';
import { Extension } from '../entity/extension.entity';
import { PsAor } from '../entity/ps-aor.entity';
import { PsAuth } from '../entity/ps-auth.entity';
import { PsEndpoint } from '../entity/ps-endpoint.entity';
import { PsAorRepository } from './ps-aor.repository';
import { PsAuthRepository } from './ps-auth.repository';
import { PsEndpointRepository } from './ps-endpoint.repository';

export interface PjsipRealtimeRows {
	endpointId: string;
	authId: string;
	aorId: string;
}

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
			aorId: `${extensionNumber}-aor`,
		};
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

	async listEndpointIds(): Promise<string[]> {
		return this.psEndpointRepository.listIds();
	}
}
