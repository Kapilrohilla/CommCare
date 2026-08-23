import { NestFactory } from '@nestjs/core';
import { AppModule } from './container';
import { env } from './config/env.config';
import { ConsoleLogger } from '@nestjs/common';

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
  await app.listen(env.HTTP_PORT);
}

bootstrap();
