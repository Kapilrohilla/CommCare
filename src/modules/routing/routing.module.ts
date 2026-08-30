import { Logger, Module } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { IvrModule } from 'src/modules/ivr/ivr.module';
import { PbxModule } from 'src/modules/pbx/pbx.module';
import { InboundRoutesController } from './controller/inbound-routes.controller';
import { InboundRoute } from './entity/inbound-route.entity';
import { InboundRouteRepository } from './repositories/inbound-route.repository';
import { InboundRoutesService } from './services/inbound-routes.service';

@Module({
	imports: [
		DatabaseModule.forFeature([InboundRoute]),
		PbxModule,
		IvrModule,
	],
	controllers: [InboundRoutesController],
	providers: [InboundRoutesService, InboundRouteRepository, Logger],
	exports: [InboundRoutesService],
})
export class RoutingModule {}
