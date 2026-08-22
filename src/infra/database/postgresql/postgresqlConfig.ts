import { env } from '../../../config/env.config';

export const DB_CONNECTION_WRITER = 'writer';
export const DB_CONNECTION_READER = 'reader';

export type DbConnectionName = typeof DB_CONNECTION_WRITER | typeof DB_CONNECTION_READER;

export const writerDbConfig = {
	host: env.WRITER_DB_HOST,
	port: env.WRITER_DB_PORT,
	username: env.WRITER_DB_USER,
	password: env.WRITER_DB_PASSWORD,
	database: env.WRITER_DB_NAME,
};

export const readerDbConfig = {
	host: env.READER_DB_HOST,
	port: env.READER_DB_PORT,
	username: env.READER_DB_USER,
	password: env.READER_DB_PASSWORD,
	database: env.READER_DB_NAME,
};

export const dbRuntimeConfig = {
	synchronize: env.ENV === 'development',
	logging: env.ENV === 'development',
};
