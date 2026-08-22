import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral } from 'typeorm';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
	DbConnectionName,
} from '../postgresql/postgresqlConfig';
import { PostgresqlService } from '../postgresql/postgresqlService';

export const DATABASE_INITIALIZED = 'DATABASE_INITIALIZED';

function createBaseRepositoryProvider(
	entity: Type<ObjectLiteral>,
	connectionName: DbConnectionName,
): Provider {
	return {
		provide: getRepositoryToken(entity, connectionName),
		useFactory: (
			_initialized: boolean,
			postgresqlService: PostgresqlService,
		) => postgresqlService.getBaseRepository(entity, connectionName),
		inject: [DATABASE_INITIALIZED, PostgresqlService],
	};
}

function createRepositoryProviders(entities: Type<ObjectLiteral>[]): Provider[] {
	return entities.flatMap((entity) => [
		createBaseRepositoryProvider(entity, DB_CONNECTION_WRITER),
		createBaseRepositoryProvider(entity, DB_CONNECTION_READER),
	]);
}

@Global()
@Module({})
export class DatabaseModule {
	static forRoot(): DynamicModule {
		return {
			module: DatabaseModule,
			providers: [
				PostgresqlService,
				{
					provide: DATABASE_INITIALIZED,
					useFactory: async (postgresqlService: PostgresqlService) => {
						await postgresqlService.initialize();
						return true;
					},
					inject: [PostgresqlService],
				},
			],
			exports: [PostgresqlService, DATABASE_INITIALIZED],
		};
	}

	static forFeature(entities: Type<ObjectLiteral>[]): DynamicModule {
		const repositoryProviders = createRepositoryProviders(entities);

		return {
			module: DatabaseModule,
			providers: repositoryProviders,
			exports: repositoryProviders,
		};
	}
}
