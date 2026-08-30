import { Injectable } from "@nestjs/common";
import { WebhookLogs } from "../entity/webhook-logs.entity";
import { WebhookLogRepository } from "../repository/webhook-log.repository";
import { AuthContext } from "src/shared/types/auth.types";

@Injectable()
export class WebhookLogsService {
	constructor(private readonly webhookLogsRepository: WebhookLogRepository) {}

	async getWebhookLogs(auth: AuthContext): Promise<WebhookLogs[]> {
		return this.webhookLogsRepository.getWebhookLogByTenantId(auth.tenantId!);
	}

	async createWebhookLog(webhookLog: WebhookLogs): Promise<WebhookLogs> {
		return this.webhookLogsRepository.createWebhookLog(webhookLog);
	}
}