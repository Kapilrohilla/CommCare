import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UsePipes,
} from '@nestjs/common';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { RequireTenant } from 'src/shared/decorators/auth.decorator';
import { CurrentAuth } from 'src/shared/decorators/current-auth.decorator';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import type { AuthContext } from 'src/shared/types/auth.types';
import ResponseService from 'src/shared/utils/services/response.service';
import {
	CreateInboundRouteDto,
	UpdateInboundRouteDto,
} from '../dto/inbound-route.dto';
import { InboundRoutesService } from '../services/inbound-routes.service';

@Controller('inbound-routes')
export class InboundRoutesController {
	constructor(private readonly inboundRoutesService: InboundRoutesService) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreateInboundRouteDto))
	async createInboundRoute(
		@CurrentAuth() auth: AuthContext,
		@Body() dto: CreateInboundRouteDto,
	) {
		const data = await this.inboundRoutesService.createInboundRoute(auth, dto);
		return ResponseService.success('Inbound route created', data);
	}

	@Get('tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getInboundRoutesByTenant(@CurrentAuth() auth: AuthContext) {
		const data =
			await this.inboundRoutesService.getInboundRoutesByTenant(auth);
		return ResponseService.success('Inbound routes fetched', data);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getInboundRouteById(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		const data = await this.inboundRoutesService.getInboundRouteById(auth, id);
		return ResponseService.success('Inbound route fetched', data);
	}

	@Patch(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(UpdateInboundRouteDto))
	async updateInboundRoute(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: UpdateInboundRouteDto,
	) {
		const data = await this.inboundRoutesService.updateInboundRoute(
			auth,
			id,
			dto,
		);
		return ResponseService.success('Inbound route updated', data);
	}

	@Delete(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async deleteInboundRoute(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		await this.inboundRoutesService.deleteInboundRoute(auth, id);
		return ResponseService.success('Inbound route deleted', { id });
	}
}
