import { Logger, Module } from '@nestjs/common';
import { DatabaseModule } from 'src/infra/database/connectors/typeORM';
import { QueueModule } from 'src/infra/queue/queue.module';
import { WebhookRegistry } from './entity/webhook.entity';
import { WebhookLogs } from './entity/webhook-logs.entity';
import { WebhookRegistryRepository } from './repository/webhook-registry.repository';
import { WebhookLogRepository } from './repository/webhook-log.repository';
import { WebhookRegistryService } from './services/webhook-registry.service';
import { WebhookLogsService } from './services/webhook-logs.service';
import { WebhookDispatcherService } from './services/webhook-dispatch.service';
import { WebhookRegistryController } from './controller/webhook-registery.controller';
import { WebhookLogsController } from './controller/webhook-logs.controller';

@Module({
	imports: [
		DatabaseModule.forFeature([WebhookRegistry, WebhookLogs]),
		QueueModule,
	],
	controllers: [WebhookRegistryController, WebhookLogsController],
	providers: [
		WebhookRegistryRepository,
		WebhookLogRepository,
		WebhookRegistryService,
		WebhookLogsService,
		WebhookDispatcherService,
		Logger,
	],
	exports: [WebhookDispatcherService, WebhookRegistryService],
})
export class WebhookModule {}
