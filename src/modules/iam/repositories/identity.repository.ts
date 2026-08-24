import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { IdentifierType } from '../constants/identity.constant';
import { IdentityEntity } from '../entity/identity.entity';

@Injectable()
export class IdentityRepository {
	constructor(
		@InjectRepository(IdentityEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<IdentityEntity>,
		@InjectRepository(IdentityEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<IdentityEntity>,
	) {}

	findByIdentifier(identifierType: IdentifierType, identifier: string): Promise<IdentityEntity | null> {
		return this.readerRepository.findOne({ where: { identifierType, identifier } });
	}

	findById(id: string): Promise<IdentityEntity | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	create(data: Partial<IdentityEntity>): Promise<IdentityEntity> {
		const identity = this.writerRepository.create(data);
		return this.writerRepository.save(identity);
	}

	save(identity: IdentityEntity): Promise<IdentityEntity> {
		return this.writerRepository.save(identity);
	}
}
