import { Module } from "@nestjs/common";
import { HealthCheckController } from "./controller/healthCheck.controller";
import { HealthCheckService } from "./services/healthCheck.service";

@Module({
	providers: [HealthCheckService],
	controllers: [HealthCheckController]
})
export class HealthCheckModule{}