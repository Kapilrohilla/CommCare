import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { VisitorEntity } from '../entity/visitor.entity';
import { VisitorAppType, VisitorIdentifierType } from '../constants/visitor.constant';

export interface UpsertVisitorInput {
	identifier: string;
	identifierType: VisitorIdentifierType;
	appType: VisitorAppType;
	userAgent?: string | null;
	metadata?: Record<string, unknown> | null;
}

@Injectable()
export class VisitorRepository {
	constructor(
		@InjectRepository(VisitorEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<VisitorEntity>,
		@InjectRepository(VisitorEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<VisitorEntity>,
	) {}

	findByIdentifier(identifierType: VisitorIdentifierType, identifier: string): Promise<VisitorEntity | null> {
		return this.readerRepository.findOne({ where: { identifierType, identifier } });
	}

	findById(id: string): Promise<VisitorEntity | null> {
		return this.readerRepository.findOne({ where: { id } });
	}

	async upsert(input: UpsertVisitorInput): Promise<VisitorEntity> {
		const existing = await this.findByIdentifier(input.identifierType, input.identifier);
		if (existing) {
			existing.appType = input.appType;
			existing.userAgent = input.userAgent ?? existing.userAgent;
			existing.metadata = input.metadata ?? existing.metadata;
			return this.writerRepository.save(existing);
		}

		const visitor = this.writerRepository.create({
			identifier: input.identifier,
			identifierType: input.identifierType,
			appType: input.appType,
			userAgent: input.userAgent ?? null,
			metadata: input.metadata ?? null,
		});
		return this.writerRepository.save(visitor);
	}
}
