import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { PsEndpointIdIp } from '../entity/ps-endpoint-id-ip.entity';

@Injectable()
export class PsEndpointIdIpRepository {
	constructor(
		@InjectRepository(PsEndpointIdIp, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<PsEndpointIdIp>,
		@InjectRepository(PsEndpointIdIp, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<PsEndpointIdIp>,
	) {}

	save(row: PsEndpointIdIp): Promise<PsEndpointIdIp> {
		return this.writerRepository.save(row);
	}

	delete(id: string): Promise<void> {
		return this.writerRepository.delete(id).then(() => undefined);
	}

	findByEndpoint(endpointId: string): Promise<PsEndpointIdIp[]> {
		return this.readerRepository.find({ where: { endpoint: endpointId } });
	}

	deleteByEndpoint(endpointId: string): Promise<void> {
		return this.writerRepository.delete({ endpoint: endpointId }).then(() => undefined);
	}
}
