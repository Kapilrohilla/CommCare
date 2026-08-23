import { Module } from '@nestjs/common';
import { DatabaseModule } from './infra/database/connectors/typeORM';
import { StorageModule } from './infra/storage/storage.module';
import { PbxModule } from './modules/pbx/pbx.module';
import { HealthCheckModule } from './modules/healthCheck/healthCheck.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { CallsModule } from './modules/calls/calls.module';

@Module({
  imports: [
    DatabaseModule.forRoot(), 
    PbxModule, HealthCheckModule, 
    TenancyModule, 
    StorageModule, 
    CallsModule
  ],
})
export class AppModule {}
