import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
} from 'src/infra/database/postgresql/postgresqlConfig';
import { QueueCallEventEntity } from '../entity/queue-call-event.entity';

@Injectable()
export class QueueCallEventRepository {
	constructor(
		@InjectRepository(QueueCallEventEntity, DB_CONNECTION_READER)
		private readonly readerRepository: BaseRepository<QueueCallEventEntity>,
		@InjectRepository(QueueCallEventEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<QueueCallEventEntity>,
	) {}

	async save(event: QueueCallEventEntity): Promise<QueueCallEventEntity> {
		return this.writerRepository.save(event);
	}

	async getByQueueCallId(queueCallId: string): Promise<QueueCallEventEntity[]> {
		return this.readerRepository.find({
			where: { queueCallId },
			order: { eventTime: 'ASC' },
		});
	}
}
