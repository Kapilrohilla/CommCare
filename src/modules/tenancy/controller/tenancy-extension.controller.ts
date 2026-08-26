import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { RequireTenant } from 'src/shared/decorators/auth.decorator';
import type { AuthContext } from 'src/shared/types/auth.types';
import { CurrentAuth } from 'src/shared/decorators/current-auth.decorator';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import ResponseService from 'src/shared/utils/services/response.service';
import {
	AssignExtensionsToUserDto,
	CreateTenantUserDto,
	RegisterExtensionToTenantDto,
	UnassignExtensionDto,
	UnregisterExtensionToTenantDto,
	UpdateTenantUserDto,
} from '../dto/tenancy-extension.dto';
import { TenancyExtensionService } from '../services/tenancy-extension.service';

@Controller('/tenancy/extension')
export class TenancyExtensionController {
	constructor(private readonly tenancyExtensionService: TenancyExtensionService) {}

	@Post('/bulk-register')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async bulkRegisterExtensionsToTenant(
		@Body(new ZodValidationPipe(RegisterExtensionToTenantDto)) body: RegisterExtensionToTenantDto,
		@CurrentAuth() auth: AuthContext,
	) {
		const data = await this.tenancyExtensionService.enqueueBulkExtensionAssignment(
			body.count,
			auth.tenantId!,
		);
		return ResponseService.success('Bulk extension registration queued', data);
	}

	@Get('/')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getExtensions(@CurrentAuth() auth: AuthContext) {
		const extensions = await this.tenancyExtensionService.getTenantExtensions(auth.tenantId);
		return ResponseService.success('Tenant extensions fetched', extensions);
	}

	@Get('/me')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getMyExtensions(@CurrentAuth() auth: AuthContext) {
		const extensions = await this.tenancyExtensionService.getMyTenantExtensions(auth.userId);
		return ResponseService.success('My extensions fetched', extensions);
	}

	@Post('/users')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async createTenantUser(
		@Body(new ZodValidationPipe(CreateTenantUserDto)) body: CreateTenantUserDto,
		@CurrentAuth() auth: AuthContext,
	) {
		const data = await this.tenancyExtensionService.createTenantUser(auth, body);
		return ResponseService.success('Tenant user created with extensions', data);
	}

	@Post('/assign')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async assignExtensionsToUser(
		@Body(new ZodValidationPipe(AssignExtensionsToUserDto)) body: AssignExtensionsToUserDto,
		@CurrentAuth() auth: AuthContext,
	) {
		const data = await this.tenancyExtensionService.assignExtensionsToUser(auth, body);
		return ResponseService.success('Extensions assigned to user', data);
	}

	@Patch('/users/:userId')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async updateTenantUser(
		@Param('userId') userId: string,
		@Body(new ZodValidationPipe(UpdateTenantUserDto)) body: UpdateTenantUserDto,
		@CurrentAuth() auth: AuthContext,
	) {
		const data = await this.tenancyExtensionService.updateTenantUser(auth, userId, body);
		return ResponseService.success('Tenant user updated', data);
	}

	@Post('/unassign')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async unassignExtension(
		@Body(new ZodValidationPipe(UnassignExtensionDto)) body: UnassignExtensionDto,
		@CurrentAuth() auth: AuthContext,
	) {
		const extension = await this.tenancyExtensionService.unassignExtension(
			body.extensionId,
			auth.userId,
			auth.tenantId,
		);
		return ResponseService.success('Extension unassigned from user', extension);
	}

	@Post('/unregister')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async unregisterExtension(
		@Body(new ZodValidationPipe(UnregisterExtensionToTenantDto)) body: UnregisterExtensionToTenantDto,
		@CurrentAuth() auth: AuthContext,
	) {
		const extension = await this.tenancyExtensionService.unregisterExtension(
			body.extensionId,
			auth.tenantId,
		);
		return ResponseService.success('Extension unregistered from tenant', extension);
	}
}
