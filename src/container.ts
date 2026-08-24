import { Module } from '@nestjs/common';
import { DatabaseModule } from './infra/database/connectors/typeORM';
import { ObservabilityModule } from './infra/observability/observability.module';
import { StorageModule } from './infra/storage/storage.module';
import { PbxModule } from './modules/pbx/pbx.module';
import { HealthCheckModule } from './modules/healthCheck/healthCheck.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { CallsModule } from './modules/calls/calls.module';
import { ClsModule } from './shared/context/cls.module';
import { RedisModule } from './infra/redis/redis.module';
import { BullMQModule } from './infra/bullmq/bullmq.module';
import { KafkaModule } from './infra/kafka/kafka.module';
import { QueueModule } from './infra/queue/queue.module';
import { SubscriberModule } from './infra/queue/subscriber.module';
import { IamModule } from './modules/iam/iam.module';

@Module({
  imports: [
    ClsModule,
    ObservabilityModule,
    DatabaseModule.forRoot(),
    RedisModule,
    BullMQModule,
    KafkaModule,
    QueueModule,
    SubscriberModule,
    PbxModule,
    HealthCheckModule,
    TenancyModule,
    StorageModule,
    CallsModule,
    IamModule,
  ],
})
export class AppModule {}
