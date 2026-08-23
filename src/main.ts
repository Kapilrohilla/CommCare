import { NestFactory } from '@nestjs/core';
import { AppModule } from './container';
import { env } from './config/env.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  await app.listen(env.HTTP_PORT);
}
bootstrap();
