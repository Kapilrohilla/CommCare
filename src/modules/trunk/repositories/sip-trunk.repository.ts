import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { SipTrunkIdentifyIp } from '../entity/sip-trunk-identify-ip.entity';
import { SipTrunk } from '../entity/sip-trunk.entity';

@Injectable()
export class SipTrunkRepository {
	constructor(
		@InjectRepository(SipTrunk, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<SipTrunk>,
		@InjectRepository(SipTrunk, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<SipTrunk>,
	) {}

	create(trunk: SipTrunk): Promise<SipTrunk> {
		return this.writerRepository.save(trunk);
	}

	async save(trunk: SipTrunk): Promise<SipTrunk> {
		return this.writerRepository.manager.transaction(async (manager) => {
			await manager.delete(SipTrunkIdentifyIp, { trunkId: trunk.id });
			for (const ip of trunk.identifyIps ?? []) {
				ip.id = undefined as unknown as string;
				ip.trunkId = trunk.id;
			}
			return manager.save(SipTrunk, trunk);
		});
	}

	delete(id: string): Promise<void> {
		return this.writerRepository.delete(id).then(() => undefined);
	}

	getByIdAndTenantId(id: string, tenantId: string): Promise<SipTrunk | null> {
		return this.readerRepository.findOne({ where: { id, tenantId } });
	}

	getByTenantId(tenantId: string): Promise<SipTrunk[]> {
		return this.readerRepository.find({
			where: { tenantId },
			order: { updatedAt: 'DESC' },
		});
	}
}
