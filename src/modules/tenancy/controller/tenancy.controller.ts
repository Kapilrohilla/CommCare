import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { CurrentAuth } from 'src/shared/decorators/current-auth.decorator';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import ResponseService from 'src/shared/utils/services/response.service';
import type { AuthContext } from 'src/shared/types/auth.types';
import { CreateTenancyDto, UpdateTenancyDto } from '../dto/tenancy.dto';
import { TenancyService } from '../services/tenancy.service';

@Controller('tenancy')
export class TenancyController {
	constructor(private readonly tenancyService: TenancyService) {}

	@Post('me')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async createMyTenancy(
		@CurrentAuth() auth: AuthContext,
		@Body(new ZodValidationPipe(CreateTenancyDto)) body: CreateTenancyDto,
	) {
		const data = await this.tenancyService.createMyTenancy(auth, body);
		return ResponseService.success('Tenant created and assigned to user', data);
	}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async createTenancy(@Body(new ZodValidationPipe(CreateTenancyDto)) body: CreateTenancyDto) {
		const tenant = await this.tenancyService.create(body);
		return ResponseService.success('Tenant created', tenant);
	}

	@Get()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async getTenancies() {
		const tenants = await this.tenancyService.findAll();
		return ResponseService.success('Tenants fetched', tenants);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async getTenancy(@Param('id') id: string) {
		const tenant = await this.tenancyService.findById(id);
		return ResponseService.success('Tenant fetched', tenant);
	}

	@Put(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async updateTenancy(
		@Param('id') id: string,
		@Body(new ZodValidationPipe(UpdateTenancyDto)) body: UpdateTenancyDto,
	) {
		const tenant = await this.tenancyService.update(id, body);
		return ResponseService.success('Tenant updated', tenant);
	}

	@Delete(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async deleteTenancy(@Param('id') id: string) {
		await this.tenancyService.delete(id);
		return ResponseService.success('Tenant deleted', null);
	}
}
