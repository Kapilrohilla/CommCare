import { Controller, Get } from "@nestjs/common";
import { HealthCheckService } from "../services/healthCheck.service";

@Controller('healthCheck')
export class HealthCheckController {

	constructor(private readonly healthCheckService: HealthCheckService){}

	@Get("/health")
	public health(){
		return this.healthCheckService.health()
	}

	@Get("/livez")
	public liveZ(){
		return this.healthCheckService.liveZ()
	}

	@Get("/readyz")
	public readyZ(){
		return this.healthCheckService.readyZ()
	}
}