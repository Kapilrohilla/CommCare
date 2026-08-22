import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import {
	dbRuntimeConfig,
	readerDbConfig,
	writerDbConfig,
} from './postgresql/postgresqlConfig';

export function getEntityGlobPath(): string {
	return join(__dirname, '../../**/*.entity{.ts,.js}');
}

function createBaseDataSourceOptions(
	config: typeof writerDbConfig,
): DataSourceOptions {
	return {
		type: 'postgres',
		host: config.host,
		port: config.port,
		username: config.username,
		password: config.password,
		database: config.database,
		entities: [getEntityGlobPath()],
		migrations: [join(__dirname, './migrations/*{.ts,.js}')],
		synchronize: dbRuntimeConfig.synchronize,
		logging: dbRuntimeConfig.logging,
	};
}

export function createWriterDataSourceOptions(): DataSourceOptions {
	return createBaseDataSourceOptions(writerDbConfig);
}

export function createReaderDataSourceOptions(): DataSourceOptions {
	return createBaseDataSourceOptions(readerDbConfig);
}
