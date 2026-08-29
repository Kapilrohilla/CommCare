import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AriConsumerAppModule } from './ari-consumer.container';

async function bootstrap() {
	const app = await NestFactory.createApplicationContext(AriConsumerAppModule, {
		bufferLogs: false,
		logger: new ConsoleLogger({
			json: true,
			logLevels: ['log', 'error', 'warn', 'debug', 'verbose'],
			timestamp: true,
			colors: true
		}),
	});

	const logger = new Logger('AriConsumerBootstrap');
	logger.log('ARI consumer application started');

	const shutdown = async (signal: string) => {
		logger.log(`Received ${signal}, shutting down ARI consumer`);
		await app.close();
		process.exit(0);
	};

	process.on('SIGTERM', () => void shutdown('SIGTERM'));
	process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error('ARI consumer failed to start:', message);
	process.exit(1);
});
