import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/connectors/typeORM";
import { TenancyController } from "./controller/tenancy.controller";
import { TenancyService } from "./services/tenancy.service";
import { TenancyRepository } from "./repositories/tenancy.repository";
import { Tenants } from "./entity/tenants.entity";

@Module({
	imports: [DatabaseModule.forFeature([Tenants])],
	controllers: [TenancyController],
	providers: [TenancyService, TenancyRepository],
})
export class TenancyModule {}