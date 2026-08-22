import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../../config/env.config';
import {
	DB_CONNECTION_READER,
	DB_CONNECTION_WRITER,
	DbConnectionName,
} from '../../../infra/database/postgresql/postgresqlConfig';
import { PostgresqlService } from '../../../infra/database/postgresql/postgresqlService';

type HealthStatus = 'ok' | 'error';

type DependencyCheck = {
	status: HealthStatus;
	message?: string;
};

type HealthChecks = {
	writerDb: DependencyCheck;
	readerDb: DependencyCheck;
};

type HealthResponse = {
	status: HealthStatus;
	checks: HealthChecks;
};

type LivezResponse = {
	status: 'ok';
	timestamp: string;
};

type ReadyzResponse = {
	status: 'ok';
	timestamp: string;
	checks: HealthChecks;
};

@Injectable()
export class HealthCheckService {
	constructor(private readonly postgresqlService: PostgresqlService) {}

	public async health(): Promise<HealthResponse> {
		const checks = await this.runDependencyChecks();

		return {
			status: this.isHealthy(checks) ? 'ok' : 'error',
			// timestamp: new Date().toISOString(),
			// env: env.ENV,

			checks,
		};
	}

	public liveZ(): LivezResponse {
		return {
			status: 'ok',
			timestamp: new Date().toISOString(),
		};
	}

	public async readyZ(): Promise<ReadyzResponse> {
		const checks = await this.runDependencyChecks();

		if (!this.isHealthy(checks)) {
			throw new ServiceUnavailableException({
				status: 'error',
				timestamp: new Date().toISOString(),
				checks,
			});
		}

		return {
			status: 'ok',
			timestamp: new Date().toISOString(),
			checks,
		};
	}

	private async runDependencyChecks(): Promise<HealthChecks> {
		const [writerDb, readerDb] = await Promise.all([
			this.checkDatabase(DB_CONNECTION_WRITER),
			this.checkDatabase(DB_CONNECTION_READER),
		]);

		return { writerDb, readerDb };
	}

	private async checkDatabase(
		connectionName: DbConnectionName,
	): Promise<DependencyCheck> {
		try {
			await this.postgresqlService.getDataSource(connectionName).query('SELECT 1');
			return { status: 'ok' };
		} catch (error) {
			return {
				status: 'error',
				message: error instanceof Error ? error.message : 'Database check failed',
			};
		}
	}

	private isHealthy(checks: HealthChecks): boolean {
		return Object.values(checks).every((check) => check.status === 'ok');
	}
}
