import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { env } from 'src/config/env.config';
import { Environment } from 'src/constants/environmentConstants';
import { TenancyService } from 'src/modules/tenancy/services/tenancy.service';
import type { AuthContext } from 'src/shared/types/auth.types';
import {
	CreateTenantDto,
	CreateUserDto,
	CreateVisitorInput,
	SendOtpDto,
	VerifyOtpDto,
} from '../dto/auth.dto';
import { AuthEventService } from './auth-event.service';
import { IdentityService } from './identity.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { UserService } from './user.service';
import { VisitorService } from './visitor.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly visitorService: VisitorService,
		private readonly identityService: IdentityService,
		private readonly userService: UserService,
		private readonly sessionService: SessionService,
		private readonly otpService: OtpService,
		private readonly authEventService: AuthEventService,
		private readonly tenancyService: TenancyService,
	) {}

	async createVisitor(dto: CreateVisitorInput) {
		const { visitor, visitorToken } = await this.visitorService.createOrUpdateVisitor(dto);
		return {
			visitorId: visitor.id,
			visitorToken,
			firstSeenAt: visitor.firstSeenAt,
			lastSeenAt: visitor.lastSeenAt,
		};
	}

	async createUser(dto: CreateUserDto) {
		const existing = await this.identityService.findByIdentifier(dto.identifierType, dto.identifier);
		if (existing?.userId) {
			throw new ConflictException('Account already exists for this identifier');
		}

		const identity =
			existing ??
			(await this.identityService.findOrCreateIdentity(dto.identifierType, dto.identifier));

		const user = await this.userService.createUser(dto.name);
		await this.identityService.linkToUser(identity, user.id);

		return {
			user: { id: user.id, name: user.name, tenantId: user.tenantId },
			identityId: identity.id,
			requiresOtpVerification: !identity.identityVerifiedAt,
		};
	}

	async sendOtp(dto: SendOtpDto) {
		const identity = await this.identityService.findOrCreateIdentity(dto.identifierType, dto.identifier);

		if (this.identityService.isLocked(identity)) {
			await this.authEventService.logOtpSent(identity.id, false, 'Account locked');
			throw new ForbiddenException('Account temporarily locked. Try again later.');
		}

		try {
			const otp = await this.otpService.generateAndStoreOtp(dto.identifierType, dto.identifier);
			await this.authEventService.logOtpSent(identity.id, true);

			const response: Record<string, unknown> = {
				identityId: identity.id,
				message: 'OTP sent successfully',
			};

			if (env.ENV === Environment.LOCAL) {
				response.devOtp = otp;
			}

			return response;
		} catch {
			await this.authEventService.logOtpSent(identity.id, false, 'Rate limit exceeded');
			throw new HttpException('Too many OTP requests. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
		}
	}

	async verifyOtp(dto: VerifyOtpDto, visitorId: string) {
		const identity = await this.identityService.findByIdentifier(dto.identifierType, dto.identifier);
		if (!identity) {
			await this.authEventService.logOtpVerified('', false, 'Identity not found');
			throw new BadRequestException('Invalid OTP');
		}

		if (this.identityService.isLocked(identity)) {
			await this.authEventService.logOtpVerified(identity.id, false, 'Account locked');
			throw new ForbiddenException('Account temporarily locked. Try again later.');
		}

		const valid = await this.otpService.verifyOtp(dto.identifierType, dto.identifier, dto.otp);
		if (!valid) {
			await this.identityService.recordFailedAttempt(identity);
			await this.authEventService.logOtpVerified(identity.id, false, 'Invalid OTP');
			throw new BadRequestException('Invalid OTP');
		}

		await this.identityService.markVerified(identity);
		await this.authEventService.logOtpVerified(identity.id, true);

		let user = identity.userId ? await this.userService.findById(identity.userId) : null;

		if (!user) {
			const name = dto.name ?? this.defaultNameFromIdentifier(dto.identifierType, dto.identifier);
			user = await this.userService.createUser(name);
			await this.identityService.linkToUser(identity, user.id);
		}

		const { tokens } = await this.sessionService.createSession({
			visitorId,
			userId: user.id,
			identityId: identity.id,
			tenantId: user.tenantId,
		});

		await this.authEventService.logLogin(user.id, identity.id, user.tenantId, true);
		await this.authEventService.logSessionCreated(user.id, identity.id, user.tenantId);

		const tenant = user.tenantId ? await this.tenancyService.findById(user.tenantId) : null;

		return {
			user: { id: user.id, name: user.name, tenantId: user.tenantId },
			tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
			requiresTenant: !user.tenantId,
			...tokens,
		};
	}

	async setupTenant(auth: AuthContext, dto: CreateTenantDto) {
		const user = await this.userService.findById(auth.userId);
		if (!user) {
			throw new UnauthorizedException('User not found');
		}
		if (user.tenantId) {
			throw new ConflictException('User already has a tenant assigned');
		}

		const tenant = await this.tenancyService.create(dto.name);
		await this.userService.assignTenant(user, tenant.id);
		const session = await this.sessionService.assignTenant(auth.sessionId, tenant.id);
		const tokens = await this.sessionService.generateTokens(session);

		return {
			tenant: { id: tenant.id, name: tenant.name },
			user: { id: user.id, name: user.name, tenantId: tenant.id },
			requiresTenant: false,
			...tokens,
		};
	}

	async refreshAccessToken(auth: AuthContext) {
		const session = await this.sessionService.validateSession(auth.sessionId);
		await this.sessionService.touchSession(session.id);
		return this.sessionService.generateAccessToken(session);
	}

	async logout(auth: AuthContext) {
		await this.sessionService.revokeSession(auth.sessionId);
		await this.authEventService.logLogout(auth.userId, auth.identityId, auth.tenantId);
		await this.authEventService.logSessionRevoked(auth.userId, auth.identityId, auth.tenantId);
		return { message: 'Logged out successfully' };
	}

	async getMe(auth: AuthContext) {
		const user = await this.userService.findById(auth.userId);
		if (!user) {
			throw new UnauthorizedException('User not found');
		}

		const tenant = user.tenantId ? await this.tenancyService.findById(user.tenantId) : null;

		return {
			user: { id: user.id, name: user.name, tenantId: user.tenantId, status: user.status },
			tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
			requiresTenant: !user.tenantId,
			sessionId: auth.sessionId,
		};
	}

	private defaultNameFromIdentifier(identifierType: string, identifier: string): string {
		if (identifierType === 'email') {
			return identifier.split('@')[0] ?? identifier;
		}
		return identifier;
	}
}
