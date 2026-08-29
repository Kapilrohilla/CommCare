import { Logger, Module } from "@nestjs/common";
import { HealthCheckController } from "./controller/healthCheck.controller";
import { HealthCheckService } from "./services/healthCheck.service";
import { PbxModule } from "../pbx/pbx.module";
import { AsteriskService } from "../pbx/services/asterisk.service";
import { RequestClient } from "src/shared/utils/services/request.service";

@Module({
	imports: [PbxModule],
	providers: [HealthCheckService,AsteriskService, AsteriskService, RequestClient, Logger],
	controllers: [HealthCheckController]
})
export class HealthCheckModule{}