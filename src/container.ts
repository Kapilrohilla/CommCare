import { Module } from '@nestjs/common';
import { DatabaseModule } from './infra/database/connectors/typeORM';
import { ObservabilityModule } from './infra/observability/observability.module';
import { StorageModule } from './infra/storage/storage.module';
import { PbxModule } from './modules/pbx/pbx.module';
import { HealthCheckModule } from './modules/healthCheck/healthCheck.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { CallsModule } from './modules/calls/calls.module';

@Module({
  imports: [
    ObservabilityModule,
    DatabaseModule.forRoot(),
    PbxModule,
    HealthCheckModule,
    TenancyModule,
    StorageModule,
    CallsModule,
  ],
})
export class AppModule {}
