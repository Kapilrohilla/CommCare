import { INestApplication, Logger } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { env } from '../../config/env.config';
import { BullMQProducerService } from './services/bullmq-producer.service';
import { Events } from '../../constants/event.constant';

function getAllEventNames(): string[] {
	return Object.values(Events);
}

/** Mount Bull Board — call only after BullMQProducerService.connect() succeeds. */
export async function setupBullMQUI(
	app: INestApplication,
	producerService: BullMQProducerService,
): Promise<void> {
	const logger = new Logger('BullMQUI');

	if (!env.BULLMQ_UI_ENABLED) {
		logger.log('BullMQ UI disabled (set BULLMQ_UI_ENABLED=true to enable)');
		return;
	}

	if (!producerService.ready) {
		logger.warn('BullMQ UI skipped — producer not connected to Redis');
		return;
	}

	try {
		const expressApp = app.getHttpAdapter().getInstance();
		const basePath = env.BULLMQ_UI_PATH;
		const allQueues = producerService.prepareMonitoringQueues(getAllEventNames());

		const serverAdapter = new ExpressAdapter();
		serverAdapter.setBasePath(basePath);

		createBullBoard({
			queues: allQueues.map((queue) => new BullMQAdapter(queue)),
			serverAdapter,
		});

		expressApp.use(basePath, serverAdapter.getRouter());

		logger.log(`BullMQ UI: http://localhost:${env.HTTP_PORT}${basePath}`);
		logger.log(`Monitoring ${allQueues.length} queue(s)`);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`BullMQ UI setup failed: ${errorMessage}`, error instanceof Error ? error : undefined);
	}
}
