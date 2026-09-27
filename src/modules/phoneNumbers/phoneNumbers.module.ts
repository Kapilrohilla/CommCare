import { Logger, Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { RoutingModule } from 'src/modules/routing/routing.module';
import { TrunkModule } from 'src/modules/trunk/trunk.module';
import { PhoneNumbersController } from './controller/phone-numbers.controller';
import { PhoneNumber } from './entity/phone-number.entity';
import { PhoneNumberRepository } from './repositories/phone-number.repository';
import { PhoneNumbersService } from './services/phone-numbers.service';

@Module({
	imports: [
		DatabaseModule.forFeature([PhoneNumber]),
		TrunkModule,
		forwardRef(() => RoutingModule),
	],
	controllers: [PhoneNumbersController],
	providers: [PhoneNumbersService, PhoneNumberRepository, Logger],
	exports: [PhoneNumbersService],
})
export class PhoneNumbersModule {}
