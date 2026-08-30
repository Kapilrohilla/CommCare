import { Injectable, NotFoundException } from "@nestjs/common";
import { WebhookRegistry } from "../entity/webhook.entity";
import { WebhookRegistryRepository } from "../repository/webhook-registry.repository";
import type { CreateWebhookRegistryDto , UpdateWebhookRegistryDto} from "../dto/webhook-registry.dto";
import { AuthContext } from "src/shared/types/auth.types";
import { WebhookRegistryEventTrigger, WebhookRegistryStatus } from "../constants/webhook.constant";

@Injectable()
export class WebhookRegistryService {
	constructor(private readonly webhookRegistryRepository: WebhookRegistryRepository) {}

	async createWebhookRegistry(webhookRegistryDto: CreateWebhookRegistryDto, auth: AuthContext): Promise<WebhookRegistry> {
		const webhookRegistry = new WebhookRegistry();
		webhookRegistry.name = webhookRegistryDto.name;
		webhookRegistry.description = webhookRegistryDto.description;
		webhookRegistry.endpoint = webhookRegistryDto.endpoint;
		webhookRegistry.headers = webhookRegistryDto.headers;
		webhookRegistry.method = webhookRegistryDto.method;
		webhookRegistry.triggerEvent = webhookRegistryDto.triggerEvent;
		webhookRegistry.status = WebhookRegistryStatus.ACTIVE;
		webhookRegistry.tenantId = auth.tenantId!;
		webhookRegistry.createdBy = auth.userId!;
		webhookRegistry.updatedBy = auth.userId!;
		return this.webhookRegistryRepository.createWebhookRegistry(webhookRegistry);
	}

	async getWebhookRegistryByEndpoint(endpoint: string): Promise<WebhookRegistry | null> {
		return this.webhookRegistryRepository.getWebhookRegistryByEndpoint(endpoint);
	}

	async getWebhookRegistryById(id: string): Promise<WebhookRegistry | null> {
		return this.webhookRegistryRepository.getWebhookRegistryById(id);
	}

	async updateWebhookRegistry(id: string, updateWebhookRegistryDto: UpdateWebhookRegistryDto, auth: AuthContext): Promise<WebhookRegistry> {
		const webhookRegistry = await this.webhookRegistryRepository.getWebhookRegistryById(id);
		if (!webhookRegistry) {
			throw new NotFoundException('Webhook registry not found');
		}
		webhookRegistry.name = updateWebhookRegistryDto.name ?? webhookRegistry.name;
		webhookRegistry.description = updateWebhookRegistryDto.description ?? webhookRegistry.description;
		webhookRegistry.endpoint = updateWebhookRegistryDto.endpoint ?? webhookRegistry.endpoint;
		webhookRegistry.headers = updateWebhookRegistryDto.headers ?? webhookRegistry.headers ?? {};
		webhookRegistry.method = updateWebhookRegistryDto.method ?? webhookRegistry.method;
		webhookRegistry.triggerEvent = updateWebhookRegistryDto.triggerEvent ?? webhookRegistry.triggerEvent;
		webhookRegistry.updatedBy = auth.userId!;
		await this.webhookRegistryRepository.updateWebhookRegistry(webhookRegistry);

		return webhookRegistry
	}

	async deleteWebhookRegistry(id: string): Promise<void> {
		return this.webhookRegistryRepository.deleteWebhookRegistry(id);
	}

	async getWebhookRegistryByTenantId(tenantId: string): Promise<WebhookRegistry[]> {
		return this.webhookRegistryRepository.getWebhookRegistryByTenantId(tenantId);
	}

	async getWebhookRegistryByEventTrigger(eventTrigger: WebhookRegistryEventTrigger): Promise<WebhookRegistry[]> {
		return this.webhookRegistryRepository.getWebhookRegistryByEventTrigger(eventTrigger);
	}

	async getActiveWebhookRegistriesByEventTrigger(
		eventTrigger: WebhookRegistryEventTrigger,
		tenantId: string,
	): Promise<WebhookRegistry[]> {
		return this.webhookRegistryRepository.getActiveWebhookRegistriesByEventTrigger(
			eventTrigger,
			tenantId,
		);
	}
}