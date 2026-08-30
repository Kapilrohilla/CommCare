import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { WebhookLogsService } from "../services/webhook-logs.service";

import { JwtAuthGuard } from "src/shared/guards/jwt-auth.guard";
import { TOKEN_TYPE } from "src/constants/tokenConstants";
import { CurrentAuth } from "src/shared/decorators/current-auth.decorator";
import type { AuthContext } from "src/shared/types/auth.types";
import { WebhookLogs } from "../entity/webhook-logs.entity";
import { RequireTenant } from "src/shared/decorators/auth.decorator";

@Controller("webhook-logs")
export class WebhookLogsController {
	constructor(private readonly webhookLogsService: WebhookLogsService) {}

	@Get('/tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getWebhookLogs(@CurrentAuth() auth: AuthContext): Promise<WebhookLogs[]> {
		return this.webhookLogsService.getWebhookLogs(auth);
	}
}