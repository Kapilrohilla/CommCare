import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from 'src/shared/utils/services/jwt.service';
import { AuthTokens, AccessTokenResponse } from 'src/shared/types/auth.types';
import { SessionEntity } from '../entity/session.entity';
import { SessionRepository } from '../repositories/session.repository';

export interface CreateSessionInput {
	visitorId: string;
	userId: string;
	identityId: string;
	tenantId: string | null;
	userAgent?: string | null;
	ip?: string | null;
}

@Injectable()
export class SessionService {
	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly jwtService: JwtService,
	) {}

	async createSession(input: CreateSessionInput): Promise<{ session: SessionEntity; tokens: AuthTokens }> {
		const expiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiryMs());
		const session = await this.sessionRepository.create({
			visitorId: input.visitorId,
			userId: input.userId,
			identityId: input.identityId,
			tenantId: input.tenantId,
			userAgent: input.userAgent ?? null,
			ip: input.ip ?? null,
			deviceName: null,
			browser: null,
			os: null,
			lastSeenAt: new Date(),
			expiresAt,
			revokedAt: null,
		});

		const tokens = await this.generateTokens(session);
		return { session, tokens };
	}

	async generateTokens(session: SessionEntity): Promise<AuthTokens> {
		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.generateAccessToken(
				session.userId,
				session.identityId,
				session.visitorId,
				session.id,
				session.tenantId,
			),
			this.jwtService.generateRefreshToken(
				session.userId,
				session.identityId,
				session.visitorId,
				session.id,
				session.tenantId,
			),
		]);

		return {
			accessToken,
			refreshToken,
			sessionId: session.id,
			expiresAt: session.expiresAt?.toISOString() ?? new Date().toISOString(),
		};
	}

	async generateAccessToken(session: SessionEntity): Promise<AccessTokenResponse> {
		const accessToken = await this.jwtService.generateAccessToken(
			session.userId,
			session.identityId,
			session.visitorId,
			session.id,
			session.tenantId,
		);
		return { accessToken };
	}

	async validateSession(sessionId: string): Promise<SessionEntity> {
		const session = await this.sessionRepository.findById(sessionId);
		if (!session) {
			throw new UnauthorizedException('Session not found');
		}
		if (session.revokedAt) {
			throw new UnauthorizedException('Session revoked');
		}
		if (session.expiresAt && session.expiresAt < new Date()) {
			throw new UnauthorizedException('Session expired');
		}
		return session;
	}

	async revokeSession(sessionId: string): Promise<void> {
		const session = await this.validateSession(sessionId);
		session.revokedAt = new Date();
		await this.sessionRepository.save(session);
	}

	async assignTenant(sessionId: string, tenantId: string): Promise<SessionEntity> {
		const session = await this.validateSession(sessionId);
		session.tenantId = tenantId;
		return this.sessionRepository.save(session);
	}

	async touchSession(sessionId: string): Promise<void> {
		const session = await this.sessionRepository.findById(sessionId);
		if (!session || session.revokedAt) {
			return;
		}
		session.lastSeenAt = new Date();
		await this.sessionRepository.save(session);
	}
}
