import { Injectable } from "@nestjs/common";
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { BaseRepository } from "src/infra/database/connectors/baseRepository";
import { WebhookLogs } from "../entity/webhook-logs.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { DB_CONNECTION_READER, DB_CONNECTION_WRITER } from "src/infra/database/postgresql/postgresqlConfig";

export type WebhookLogQuery = {
	from?: Date;
	to?: Date;
};

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
		return this.readerWebhookLogRepository.find({ where: { webhookRegistryId }, order: { createdAt: 'DESC' } });
	}

	async getWebhookLogByTenantId(tenantId: string, query: WebhookLogQuery = {}): Promise<WebhookLogs[]> {
		const where: FindOptionsWhere<WebhookLogs> = { tenantId };
		if (query.from && query.to) {
			where.createdAt = Between(query.from, query.to);
		} else if (query.from) {
			where.createdAt = MoreThanOrEqual(query.from);
		} else if (query.to) {
			where.createdAt = LessThanOrEqual(query.to);
		}
		return this.readerWebhookLogRepository.find({
			where,
			order: { createdAt: 'DESC' },
			take: 200,
		});
	}
}
