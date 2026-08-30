import { Injectable } from "@nestjs/common";
import { WebhookRegistry } from "../entity/webhook.entity";
import { BaseRepository } from "src/infra/database/connectors/baseRepository";
import { InjectRepository } from "@nestjs/typeorm";
import { DB_CONNECTION_READER, DB_CONNECTION_WRITER } from "src/infra/database/postgresql/postgresqlConfig";
import { WebhookRegistryEventTrigger, WebhookRegistryStatus } from "../constants/webhook.constant";

@Injectable()
export class WebhookRegistryRepository {
	constructor(
		@InjectRepository(WebhookRegistry, DB_CONNECTION_WRITER)
		private readonly writerWebhookRegistryRepository: BaseRepository<WebhookRegistry>,
		@InjectRepository(WebhookRegistry, DB_CONNECTION_READER)
		private readonly readerWebhookRegistryRepository: BaseRepository<WebhookRegistry>,
	) {}

	async createWebhookRegistry(webhookRegistry: Partial<WebhookRegistry>): Promise<WebhookRegistry> {
		return this.writerWebhookRegistryRepository.save(webhookRegistry);
	}

	async getWebhookRegistryByEndpoint(endpoint: string): Promise<WebhookRegistry | null> {
		return this.readerWebhookRegistryRepository.findOne({ where: { endpoint } });
	}

	async getWebhookRegistryById(id: string): Promise<WebhookRegistry | null> {
		return this.readerWebhookRegistryRepository.findOne({ where: { id } });
	}

	async updateWebhookRegistry(webhookRegistry: WebhookRegistry): Promise<void> {
		await  this.writerWebhookRegistryRepository.update(webhookRegistry.id, webhookRegistry);
		return;
	}

	async deleteWebhookRegistry(id: string): Promise<void> {
		await this.writerWebhookRegistryRepository.delete(id);
	}

	async getWebhookRegistryByTenantId(tenantId: string): Promise<WebhookRegistry[]> {
		return this.readerWebhookRegistryRepository.find({ where: { tenantId } });
	}

	async getWebhookRegistryByEventTrigger(eventTrigger: WebhookRegistryEventTrigger): Promise<WebhookRegistry[]> {
		return this.readerWebhookRegistryRepository.find({
			where: { triggerEvent: eventTrigger, status: WebhookRegistryStatus.ACTIVE },
		});
	}

	async getActiveWebhookRegistriesByEventTrigger(
		eventTrigger: WebhookRegistryEventTrigger,
		tenantId: string,
	): Promise<WebhookRegistry[]> {
		return this.readerWebhookRegistryRepository.find({
			where: {
				triggerEvent: eventTrigger,
				tenantId,
				status: WebhookRegistryStatus.ACTIVE,
			},
		});
	}
}