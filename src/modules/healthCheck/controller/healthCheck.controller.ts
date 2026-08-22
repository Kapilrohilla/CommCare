import {
	Controller,
	Get,
	HttpException,
	HttpStatus,
	ServiceUnavailableException,
} from '@nestjs/common';
import ResponseService from '../../../shared/utils/services/response.service';
import { HealthCheckService } from '../services/healthCheck.service';

@Controller('healthCheck')
export class HealthCheckController {
	constructor(private readonly healthCheckService: HealthCheckService) {}

	@Get('/health')
	public async health() {
		const data = await this.healthCheckService.health();

		if (data.status === 'ok') {
			return ResponseService.success(
				'Health check successful',
				data,
			);
		}

		throw new HttpException(
			await ResponseService.error(
				'Health check failed',
			),
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}

	@Get('/livez')
	public liveZ() {
		const data = this.healthCheckService.liveZ();
		return ResponseService.success(
			'Liveness check successful',
			data,
		);
	}

	@Get('/readyz')
	public async readyZ() {
		try {
			const data = await this.healthCheckService.readyZ();
			return ResponseService.success(
				'Readiness check successful',
				data,
			);
		} catch (error) {
			if (error instanceof ServiceUnavailableException) {
				throw new HttpException(
					await ResponseService.error('Readiness check failed'),
					HttpStatus.SERVICE_UNAVAILABLE,
				);
			}

			throw error;
		}
	}
}
