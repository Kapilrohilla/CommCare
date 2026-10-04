import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { CreateWebhookRegistryDto, UpdateWebhookRegistryDto } from "../dto/webhook-registry.dto";
import { ZodValidationPipe } from "src/shared/pipes/zodValidationPipe";
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
	async createWebhookRegistry(@Body(new ZodValidationPipe(CreateWebhookRegistryDto)) createWebhookRegistryDto: CreateWebhookRegistryDto, @CurrentAuth() auth: AuthContext): Promise<WebhookRegistry> {
		return this.webhookRegistryService.createWebhookRegistry(createWebhookRegistryDto, auth);
	}

	@Get('/tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getWebhookRegistryByTenant(@CurrentAuth() auth: AuthContext): Promise<WebhookRegistry[]> {
		return this.webhookRegistryService.getWebhookRegistryByTenantId(auth.tenantId!);
	}

	@Get('/:id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async getWebhookRegistry(@Param('id') id: string) {
		return this.webhookRegistryService.getWebhookRegistryById(id);
	}

	@Put('/:id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async updateWebhookRegistry(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateWebhookRegistryDto)) updateWebhookRegistryDto: UpdateWebhookRegistryDto, @CurrentAuth() auth: AuthContext): Promise<WebhookRegistry> {
		return this.webhookRegistryService.updateWebhookRegistry(id, updateWebhookRegistryDto, auth);
	}

	@Patch('/:id/disable')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async disableWebhookRegistry(@Param('id') id: string, @CurrentAuth() auth: AuthContext): Promise<WebhookRegistry> {
		return this.webhookRegistryService.disableWebhookRegistry(id, auth);
	}

	@Patch('/:id/enable')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async enableWebhookRegistry(@Param('id') id: string, @CurrentAuth() auth: AuthContext): Promise<WebhookRegistry> {
		return this.webhookRegistryService.enableWebhookRegistry(id, auth);
	}

	@Delete('/:id')
	@HttpCode(204)
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async deleteWebhookRegistry(@Param('id') id: string, @CurrentAuth() auth: AuthContext): Promise<void> {
		return this.webhookRegistryService.deleteWebhookRegistry(id, auth.tenantId!);
	}
}
