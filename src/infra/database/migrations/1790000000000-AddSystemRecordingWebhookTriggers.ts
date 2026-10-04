import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the WebhookRegistry.triggerEvent enum with the SystemRecording events.
 *
 * Enum type name is the one TypeORM generates for the column:
 * `<table>_<column lowercased>_enum` => webhook_registry_triggerevent_enum
 * (table `webhook_registry` from entity class WebhookRegistry).
 */
export class AddSystemRecordingWebhookTriggers1790000000000
	implements MigrationInterface
{
	name = 'AddSystemRecordingWebhookTriggers1790000000000';

	// ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older Postgres.
	transaction = false as const;

	public async up(queryRunner: QueryRunner): Promise<void> {
		for (const value of [
			'SystemRecording.Uploaded',
			'SystemRecording.Processed',
			'SystemRecording.Failed',
		]) {
			await queryRunner.query(
				`ALTER TYPE "webhook_registry_triggerevent_enum" ADD VALUE IF NOT EXISTS '${value}'`,
			);
		}
	}

	public async down(): Promise<void> {
		// Postgres cannot drop enum values; leaving them in place is harmless.
	}
}
