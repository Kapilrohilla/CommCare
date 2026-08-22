import {
	Injectable,
	Logger,
	OnModuleDestroy,
} from '@nestjs/common';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { BaseRepository } from '../connectors/baseRepository';
import {
	createReaderDataSourceOptions,
	createWriterDataSourceOptions,
} from '../dataSource';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
	DbConnectionName,
} from './postgresqlConfig';

@Injectable()
export class PostgresqlService implements OnModuleDestroy {
	private readonly logger = new Logger(PostgresqlService.name);
	private writerDataSource?: DataSource;
	private readerDataSource?: DataSource;
	private initialized = false;

	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		this.writerDataSource = new DataSource(createWriterDataSourceOptions());
		this.readerDataSource = new DataSource(createReaderDataSourceOptions());

		await Promise.all([
			this.writerDataSource.initialize(),
			this.readerDataSource.initialize(),
		]);

		this.initialized = true;
		this.logger.log('Writer and reader database connections initialized');
	}

	async onModuleDestroy(): Promise<void> {
		const closeTasks: Promise<void>[] = [];

		if (this.writerDataSource?.isInitialized) {
			closeTasks.push(this.writerDataSource.destroy());
		}

		if (this.readerDataSource?.isInitialized) {
			closeTasks.push(this.readerDataSource.destroy());
		}

		await Promise.all(closeTasks);
		this.logger.log('Writer and reader database connections closed');
	}

	getDataSource(connectionName: DbConnectionName): DataSource {
		const dataSource =
			connectionName === DB_CONNECTION_WRITER
				? this.writerDataSource
				: this.readerDataSource;

		if (!dataSource?.isInitialized) {
			throw new Error(`Database connection "${connectionName}" is not initialized`);
		}

		return dataSource;
	}

	getWriterDataSource(): DataSource {
		return this.getDataSource(DB_CONNECTION_WRITER);
	}

	getReaderDataSource(): DataSource {
		return this.getDataSource(DB_CONNECTION_READER);
	}

	getBaseRepository<T extends ObjectLiteral>(
		entity: EntityTarget<T>,
		connectionName: DbConnectionName,
	): BaseRepository<T> {
		const repository = this.getDataSource(connectionName).getRepository(entity);
		return new BaseRepository(repository);
	}
}
