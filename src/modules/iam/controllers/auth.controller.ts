import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import { CurrentAuth, CurrentVisitor } from 'src/shared/decorators/current-auth.decorator';
import { JwtAuthGuard } from 'src/shared/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'src/shared/pipes/zodValidationPipe';
import { ResponseService } from 'src/shared/utils/services/response.service';
import { extractVisitorRequestContext } from 'src/shared/utils/extract-visitor-request-context.util';
import type { AuthContext } from 'src/shared/types/auth.types';
import {
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
	async createVisitor(
		@Body(new ZodValidationPipe(CreateVisitorDto)) body: CreateVisitorDto,
		@Req() req: Request,
	) {
		const { userAgent, metadata } = extractVisitorRequestContext(req.headers);
		const data = await this.authService.createVisitor({ ...body, userAgent, metadata });
		return ResponseService.success('Visitor created', data);
	}

	@Post('users')
	@JwtAuthGuard(TOKEN_TYPE.VISITOR)
	async createUser(@Body(new ZodValidationPipe(CreateUserDto)) body: CreateUserDto) {
		const data = await this.authService.createUser(body);
		return ResponseService.success('User account created', data);
	}

	@Post('otp/send')
	@JwtAuthGuard(TOKEN_TYPE.VISITOR)
	async sendOtp(@Body(new ZodValidationPipe(SendOtpDto)) body: SendOtpDto) {
		const data = await this.authService.sendOtp(body);
		return ResponseService.success('OTP sent', data);
	}

	@Post('otp/verify')
	@JwtAuthGuard(TOKEN_TYPE.VISITOR)
	async verifyOtp(
		@Body(new ZodValidationPipe(VerifyOtpDto)) body: VerifyOtpDto,
		@CurrentVisitor() visitor: { visitorId: string },
	) {
		const data = await this.authService.verifyOtp(body, visitor.visitorId);
		return ResponseService.success('OTP verified', data);
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
