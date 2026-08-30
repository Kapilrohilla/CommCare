import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import type { CreateWebhookRegistryDto, UpdateWebhookRegistryDto } from "../dto/webhook-registry.dto";
import { WebhookRegistryService } from "../services/webhook-registry.service";
import { CurrentAuth } from "src/shared/decorators/current-auth.decorator";
import type { AuthContext } from "src/shared/types/auth.types";
import { JwtAuthGuard } from "src/shared/guards/jwt-auth.guard";
import { TOKEN_TYPE } from "src/constants/tokenConstants";
import { RequireTenant } from "src/shared/decorators/auth.decorator";
import { WebhookRegistry } from "../entity/webhook.entity";

@Controller("webhook-registry")
export class WebhookRegistryController {
	constructor(private readonly webhookRegistryService: WebhookRegistryService) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async createWebhookRegistry(@Body() createWebhookRegistryDto: CreateWebhookRegistryDto, @CurrentAuth() auth: AuthContext): Promise<WebhookRegistry> {
		return this.webhookRegistryService.createWebhookRegistry(createWebhookRegistryDto, auth);
	}

	@Get('/:id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async getWebhookRegistry(@Param('id') id: string) {
		return this.webhookRegistryService.getWebhookRegistryById(id);
	}

	@Get('/tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getWebhookRegistryByTenant(@CurrentAuth() auth: AuthContext): Promise<WebhookRegistry[]> {
		return this.webhookRegistryService.getWebhookRegistryByTenantId(auth.tenantId!);
	}

	@Put('/:id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async updateWebhookRegistry(@Param('id') id: string, @Body() updateWebhookRegistryDto: UpdateWebhookRegistryDto, @CurrentAuth() auth: AuthContext): Promise<WebhookRegistry> {
		return this.webhookRegistryService.updateWebhookRegistry(id, updateWebhookRegistryDto, auth);
	}
}