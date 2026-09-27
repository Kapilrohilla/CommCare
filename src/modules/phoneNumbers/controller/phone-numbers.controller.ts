import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UsePipes,
} from '@nestjs/common';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { RequireTenant } from 'src/shared/decorators/auth.decorator';
import { CurrentAuth } from 'src/shared/decorators/current-auth.decorator';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import type { AuthContext } from 'src/shared/types/auth.types';
import ResponseService from 'src/shared/utils/services/response.service';
import { PhoneNumberStatus } from '../constants/phone-number.constant';
import {
	CreatePhoneNumberDto,
	UpdatePhoneNumberDto,
} from '../dto/phone-number.dto';
import { PhoneNumbersService } from '../services/phone-numbers.service';

@Controller('phone-numbers')
export class PhoneNumbersController {
	constructor(private readonly phoneNumbersService: PhoneNumbersService) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreatePhoneNumberDto))
	async createPhoneNumber(
		@CurrentAuth() auth: AuthContext,
		@Body() dto: CreatePhoneNumberDto,
	) {
		const data = await this.phoneNumbersService.createPhoneNumber(auth, dto);
		return ResponseService.success('Phone number created', data);
	}

	@Get()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async listPhoneNumbers(
		@CurrentAuth() auth: AuthContext,
		@Query('sipTrunkId') sipTrunkId?: string,
		@Query('status') status?: PhoneNumberStatus,
		@Query('search') search?: string,
	) {
		const data = await this.phoneNumbersService.listPhoneNumbers(auth, {
			sipTrunkId,
			status,
			search,
		});
		return ResponseService.success('Phone numbers fetched', data);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getPhoneNumberById(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		const data = await this.phoneNumbersService.getPhoneNumberById(auth, id);
		return ResponseService.success('Phone number fetched', data);
	}

	@Patch(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(UpdatePhoneNumberDto))
	async updatePhoneNumber(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: UpdatePhoneNumberDto,
	) {
		const data = await this.phoneNumbersService.updatePhoneNumber(auth, id, dto);
		return ResponseService.success('Phone number updated', data);
	}

	@Delete(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async deletePhoneNumber(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
	) {
		await this.phoneNumbersService.deletePhoneNumber(auth, id);
		return ResponseService.success('Phone number deleted', { id });
	}
}
