import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../infra/database/connectors/typeORM';
import { IamModule } from '../iam/iam.module';
import { TenancyController } from './controller/tenancy.controller';
import { TenancyService } from './services/tenancy.service';
import { TenancyRepository } from './repositories/tenancy.repository';
import { Tenants } from './entity/tenants.entity';

@Module({
	imports: [DatabaseModule.forFeature([Tenants]), forwardRef(() => IamModule)],
	controllers: [TenancyController],
	providers: [TenancyService, TenancyRepository],
	exports: [TenancyService],
})
export class TenancyModule {}
