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
	CreateSipTrunkDto,
	UpdateSipTrunkDto,
} from '../dto/sip-trunk.dto';
import { SipTrunkService } from '../services/sip-trunk.service';

@Controller('pbx/trunks')
export class SipTrunkController {
	constructor(private readonly sipTrunkService: SipTrunkService) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreateSipTrunkDto))
	async createTrunk(
		@CurrentAuth() auth: AuthContext,
		@Body() dto: CreateSipTrunkDto,
	) {
		const data = await this.sipTrunkService.createTrunk(auth, dto);
		return ResponseService.success('SIP trunk created', this.toResponse(data));
	}

	@Get('tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getTrunksByTenant(@CurrentAuth() auth: AuthContext) {
		const data = await this.sipTrunkService.getTrunksByTenant(auth);
		return ResponseService.success(
			'SIP trunks fetched',
			data.map((trunk) => this.toResponse(trunk)),
		);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getTrunkById(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		const data = await this.sipTrunkService.getTrunkById(auth, id);
		return ResponseService.success('SIP trunk fetched', this.toResponse(data));
	}

	@Patch(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(UpdateSipTrunkDto))
	async updateTrunk(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: UpdateSipTrunkDto,
	) {
		const data = await this.sipTrunkService.updateTrunk(auth, id, dto);
		return ResponseService.success('SIP trunk updated', this.toResponse(data));
	}

	@Delete(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async deleteTrunk(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		await this.sipTrunkService.deleteTrunk(auth, id);
		return ResponseService.success('SIP trunk deleted', null);
	}

	@Post(':id/sync-asterisk')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async syncTrunkAsterisk(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		const data = await this.sipTrunkService.syncTrunkAsterisk(auth, id);
		return ResponseService.success(
			'SIP trunk synced to Asterisk',
			this.toResponse(data),
		);
	}

	private toResponse(trunk: {
		id: string;
		tenantId: string;
		name: string;
		authMode: string;
		username: string | null;
		enabled: boolean;
		pjsipEndpointId: string;
		identifyIps?: { id?: string; match: string }[];
		createdAt: Date;
		updatedAt: Date;
	}) {
		return {
			id: trunk.id,
			tenantId: trunk.tenantId,
			name: trunk.name,
			authMode: trunk.authMode,
			username: trunk.username,
			enabled: trunk.enabled,
			pjsipEndpointId: trunk.pjsipEndpointId,
			identifyIps: (trunk.identifyIps ?? []).map((row) => ({
				id: row.id,
				match: row.match,
			})),
			createdAt: trunk.createdAt,
			updatedAt: trunk.updatedAt,
		};
	}
}
