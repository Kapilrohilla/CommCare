import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../infra/database/connectors/typeORM';
import { QueueModule } from 'src/infra/queue/queue.module';
import { PbxModule } from '../pbx/pbx.module';
import { IamModule } from '../iam/iam.module';
import { TenancyController } from './controller/tenancy.controller';
import { TenancyExtensionController } from './controller/tenancy-extension.controller';
import { TenancyService } from './services/tenancy.service';
import { TenancyExtensionService } from './services/tenancy-extension.service';
import { TenancyRepository } from './repositories/tenancy.repository';
import { Tenants } from './entity/tenants.entity';

@Module({
	imports: [
		DatabaseModule.forFeature([Tenants]),
		QueueModule,
		PbxModule,
		forwardRef(() => IamModule),
	],
	controllers: [TenancyExtensionController,TenancyController ],
	providers: [TenancyService, TenancyExtensionService, TenancyRepository],
	exports: [TenancyService, TenancyExtensionService],
})
export class TenancyModule {}
