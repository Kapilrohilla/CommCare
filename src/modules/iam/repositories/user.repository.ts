import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { UserEntity } from '../entity/user.entity';

@Injectable()
export class UserRepository {
	constructor(
		@InjectRepository(UserEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<UserEntity>,
		@InjectRepository(UserEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<UserEntity>,
	) {}

	findById(id: string): Promise<UserEntity | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	findByTenantId(tenantId: string): Promise<UserEntity[]> {
		return this.readerRepository.find({ where: { tenantId } });
	}

	create(data: Partial<UserEntity>): Promise<UserEntity> {
		const user = this.writerRepository.create(data);
		return this.writerRepository.save(user);
	}

	save(user: UserEntity): Promise<UserEntity> {
		return this.writerRepository.save(user);
	}
}
