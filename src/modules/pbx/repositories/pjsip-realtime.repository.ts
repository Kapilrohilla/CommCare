import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DB_CONNECTION_WRITER } from 'src/infra/database/postgresql/postgresqlConfig';
import { Extension } from '../entity/extension.entity';

export interface PjsipRealtimeRows {
	endpointId: string;
	authId: string;
	aorId: string;
}

@Injectable()
export class PjsipRealtimeRepository {
	constructor(
		@InjectDataSource(DB_CONNECTION_WRITER)
		private readonly dataSource: DataSource,
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

		await this.dataSource.transaction(async (manager) => {
			await manager.query(
				`INSERT INTO ps_auths (id, auth_type, username, password)
				 VALUES ($1, 'userpass', $2, $3)
				 ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password`,
				[authId, extension.pjsipUsername, extension.pjsipPassword],
			);

			await manager.query(
				`INSERT INTO ps_aors (id, max_contacts, remove_existing)
				 VALUES ($1, 3, 'yes')
				 ON CONFLICT (id) DO NOTHING`,
				[aorId],
			);

			await manager.query(
				`INSERT INTO ps_endpoints (
					id, transport, aors, auth, context, disallow, allow,
					direct_media, rtp_symmetric, force_rport, rewrite_contact,
					callerid, media_use_received_transport
				) VALUES (
					$1, 'transport-udp', $2, $3, 'from-internal', 'all', 'ulaw,alaw,gsm',
					'no', 'yes', 'yes', 'yes', $4, 'yes'
				)
				ON CONFLICT (id) DO UPDATE SET
					aors = EXCLUDED.aors,
					auth = EXCLUDED.auth,
					callerid = EXCLUDED.callerid`,
				[endpointId, aorId, authId, callerId],
			);
		});
	}

	async deleteExtension(extensionNumber: string): Promise<void> {
		const { endpointId, authId, aorId } = this.endpointIds(extensionNumber);

		await this.dataSource.transaction(async (manager) => {
			await manager.query(`DELETE FROM ps_endpoints WHERE id = $1`, [endpointId]);
			await manager.query(`DELETE FROM ps_auths WHERE id = $1`, [authId]);
			await manager.query(`DELETE FROM ps_aors WHERE id = $1`, [aorId]);
		});
	}

	async listEndpointIds(): Promise<string[]> {
		const rows = (await this.dataSource.query(
			`SELECT id FROM ps_endpoints ORDER BY id`,
		)) as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}
}
