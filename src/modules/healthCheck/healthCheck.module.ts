import { Logger, Module } from "@nestjs/common";
import { HealthCheckController } from "./controller/healthCheck.controller";
import { HealthCheckService } from "./services/healthCheck.service";
import { AsteriskHealthService } from "./services/asterisk-health.service";
import { PbxModule } from "../pbx/pbx.module";
import { AsteriskService } from "../pbx/services/asterisk.service";
import { RequestClient } from "src/shared/utils/services/request.service";

@Module({
	imports: [PbxModule],
	providers: [HealthCheckService, AsteriskHealthService, AsteriskService, RequestClient, Logger],
	controllers: [HealthCheckController]
})
export class HealthCheckModule{}