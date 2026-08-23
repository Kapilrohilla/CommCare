import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/infra/database/connectors/typeORM";
import { CallEntity } from "./entity/calls.entity";
import { CallsController } from "./controller/calls.controller";
import { CallsService } from "./services/calls.service";
import { CallsRepository } from "./repositories/calls.repository";

@Module({
	imports: [DatabaseModule.forFeature([CallEntity])],
	controllers: [CallsController],
	providers: [CallsService, CallsRepository],
	exports: [CallsService, CallsRepository],
})
export class CallsModule {}