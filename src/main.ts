import './infra/observability/tracing/tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './container';
import { env } from './config/env.config';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { setupBullMQUI } from './infra/bullmq/bullUI';
import { BullMQProducerService } from './infra/bullmq/services/bullmq-producer.service';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: new ConsoleLogger({
      json: true,
      logLevels: ["log", "error", "warn", "debug", "verbose"],
      timestamp: true,
      colors: true
    })
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  const logger = new Logger('Bootstrap');
  const producerService = app.get(BullMQProducerService, { strict: false });

  const bullmqReady = await producerService.connect({ retries: 5, delayMs: 2000 });
  if (bullmqReady) {
    logger.log('BullMQ producer ready');
    await setupBullMQUI(app, producerService);
  } else {
    logger.warn('BullMQ unavailable — UI and job publishing disabled until Redis is reachable');
  }

  await app.listen(env.HTTP_PORT);
}

bootstrap();
