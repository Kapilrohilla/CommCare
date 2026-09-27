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
import { CreateQueueMemberDto } from '../dto/queue-member.dto';
import { CreateQueueDto, UpdateQueueDto } from '../dto/queue.dto';
import { QueueMembersService } from '../services/queue-members.service';
import { QueuesService } from '../services/queues.service';

@Controller('queues')
export class QueuesController {
	constructor(
		private readonly queuesService: QueuesService,
		private readonly queueMembersService: QueueMembersService,
	) {}

	@Post()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreateQueueDto))
	async createQueue(@CurrentAuth() auth: AuthContext, @Body() dto: CreateQueueDto) {
		const data = await this.queuesService.createQueue(auth, dto);
		return ResponseService.success('Queue created', data);
	}

	@Get()
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getQueuesByTenant(@CurrentAuth() auth: AuthContext) {
		const data = await this.queuesService.getQueuesByTenant(auth);
		return ResponseService.success('Queues fetched', data);
	}

	@Get(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async getQueueById(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
		const data = await this.queuesService.getQueueById(auth, id);
		return ResponseService.success('Queue fetched', data);
	}

	@Patch(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(UpdateQueueDto))
	async updateQueue(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: UpdateQueueDto,
	) {
		const data = await this.queuesService.updateQueue(auth, id, dto);
		return ResponseService.success('Queue updated', data);
	}

	@Delete(':id')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async deleteQueue(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
		await this.queuesService.deleteQueue(auth, id);
		return ResponseService.success('Queue deleted', { id });
	}

	@Post(':id/members')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	@UsePipes(new ZodValidationPipe(CreateQueueMemberDto))
	async addMember(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Body() dto: CreateQueueMemberDto,
	) {
		const data = await this.queueMembersService.addMember(auth, id, dto);
		return ResponseService.success('Queue member added', data);
	}

	@Get(':id/members')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async listMembers(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
		const data = await this.queueMembersService.listMembers(auth, id);
		return ResponseService.success('Queue members fetched', data);
	}

	@Delete(':id/members/:agentId')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@RequireTenant()
	async removeMember(
		@CurrentAuth() auth: AuthContext,
		@Param('id') id: string,
		@Param('agentId') agentId: string,
	) {
		await this.queueMembersService.removeMember(auth, id, agentId);
		return ResponseService.success('Queue member removed', { id, agentId });
	}
}
