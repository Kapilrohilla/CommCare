import { Injectable } from "@nestjs/common";
import { BaseRepository } from "src/infra/database/connectors/baseRepository";
import { WebhookLogs } from "../entity/webhook-logs.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { DB_CONNECTION_READER, DB_CONNECTION_WRITER } from "src/infra/database/postgresql/postgresqlConfig";

@Injectable()
export class WebhookLogRepository {
	constructor(
		@InjectRepository(WebhookLogs, DB_CONNECTION_WRITER)
		private readonly writerWebhookLogRepository: BaseRepository<WebhookLogs>,
		@InjectRepository(WebhookLogs, DB_CONNECTION_READER)
		private readonly readerWebhookLogRepository: BaseRepository<WebhookLogs>,
	) {}

	async createWebhookLog(webhookLog: Partial<WebhookLogs>): Promise<WebhookLogs> {
		return this.writerWebhookLogRepository.save(webhookLog);
	}

	async getWebhookLogByWebhookRegistryId(webhookRegistryId: string): Promise<WebhookLogs[]> {
		return this.readerWebhookLogRepository.find({ where: { webhookRegistryId } });
	}

	async getWebhookLogByTenantId(tenantId: string): Promise<WebhookLogs[]> {
		return this.readerWebhookLogRepository.find({ where: { tenantId } });
	}
}