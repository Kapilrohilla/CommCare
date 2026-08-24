import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { CurrentAuth, CurrentVisitor } from 'src/shared/decorators/current-auth.decorator';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import { ResponseService } from 'src/shared/utils/services/response.service';
import type { AuthContext } from 'src/shared/types/auth.types';
import {
	CreateTenantDto,
	CreateUserDto,
	CreateVisitorDto,
	SendOtpDto,
	VerifyOtpDto,
} from '../dto/auth.dto';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('visitor')
	@UsePipes(new ZodValidationPipe(CreateVisitorDto))
	async createVisitor(@Body() body: CreateVisitorDto) {
		const data = await this.authService.createVisitor(body);
		return ResponseService.success('Visitor created', data);
	}

	@Post('users')
	@JwtAuthGuard(TOKEN_TYPE.VISITOR)
	@UsePipes(new ZodValidationPipe(CreateUserDto))
	async createUser(@Body() body: CreateUserDto) {
		const data = await this.authService.createUser(body);
		return ResponseService.success('User account created', data);
	}

	@Post('otp/send')
	@JwtAuthGuard(TOKEN_TYPE.VISITOR)
	@UsePipes(new ZodValidationPipe(SendOtpDto))
	async sendOtp(@Body() body: SendOtpDto) {
		const data = await this.authService.sendOtp(body);
		return ResponseService.success('OTP sent', data);
	}

	@Post('otp/verify')
	@JwtAuthGuard(TOKEN_TYPE.VISITOR)
	@UsePipes(new ZodValidationPipe(VerifyOtpDto))
	async verifyOtp(@Body() body: VerifyOtpDto, @CurrentVisitor() visitor: { visitorId: string }) {
		const data = await this.authService.verifyOtp(body, visitor.visitorId);
		return ResponseService.success('OTP verified', data);
	}

	@Post('tenant')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	@UsePipes(new ZodValidationPipe(CreateTenantDto))
	async setupTenant(@CurrentAuth() auth: AuthContext, @Body() body: CreateTenantDto) {
		const data = await this.authService.setupTenant(auth, body);
		return ResponseService.success('Tenant created', data);
	}

	@Post('refresh')
	@JwtAuthGuard(TOKEN_TYPE.REFRESH)
	async refresh(@CurrentAuth() auth: AuthContext) {
		const data = await this.authService.refreshAccessToken(auth);
		return ResponseService.success('Access token refreshed', data);
	}

	@Post('logout')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async logout(@CurrentAuth() auth: AuthContext) {
		const data = await this.authService.logout(auth);
		return ResponseService.success('Logged out', data);
	}

	@Get('me')
	@JwtAuthGuard(TOKEN_TYPE.ACCESS)
	async getMe(@CurrentAuth() auth: AuthContext) {
		const data = await this.authService.getMe(auth);
		return ResponseService.success('Profile fetched', data);
	}
}
