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
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import ResponseService from 'src/shared/utils/services/response.service';
import {
	CreateGlobalConfigDto,
	UpdateGlobalConfigDto,
} from '../dto/global-config.dto';
import { GlobalConfigService } from '../services/global-config.service';

@Controller('global-config')
export class GlobalConfigController {
	constructor(private readonly globalConfigService: GlobalConfigService) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@UsePipes(new ZodValidationPipe(CreateGlobalConfigDto))
	async create(@Body() dto: CreateGlobalConfigDto) {
		const data = await this.globalConfigService.create(dto);
		return ResponseService.success('Global config created', data);
	}

	@Get()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async findAll() {
		const data = await this.globalConfigService.findAll();
		return ResponseService.success('Global configs fetched', data);
	}

	@Get('key/:key')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async findByKey(@Param('key') key: string) {
		const data = await this.globalConfigService.findByKey(key);
		return ResponseService.success('Global config fetched', data);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async findById(@Param('id') id: string) {
		const data = await this.globalConfigService.findById(id);
		return ResponseService.success('Global config fetched', data);
	}

	@Patch(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@UsePipes(new ZodValidationPipe(UpdateGlobalConfigDto))
	async update(@Param('id') id: string, @Body() dto: UpdateGlobalConfigDto) {
		const data = await this.globalConfigService.update(id, dto);
		return ResponseService.success('Global config updated', data);
	}

	@Delete(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async delete(@Param('id') id: string) {
		await this.globalConfigService.delete(id);
		return ResponseService.success('Global config deleted', null);
	}
}
