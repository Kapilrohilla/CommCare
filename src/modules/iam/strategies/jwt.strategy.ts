import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from 'src/config/env.config';
import { TOKEN_TYPE } from 'src/constants/tokenConstants';
import type { AuthContext, SessionTokenPayload } from 'src/shared/types/auth.types';
import { SessionService } from '../services/session.service';
import { VisitorService } from '../services/visitor.service';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, TOKEN_TYPE.ACCESS) {
	constructor(private readonly sessionService: SessionService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: env.JWT_SECRET,
			algorithms: ['HS256'],
		});
	}

	async validate(payload: SessionTokenPayload): Promise<AuthContext> {
		if (payload.tokenType !== 'access') {
			throw new UnauthorizedException('Invalid token type');
		}

		const session = await this.sessionService.validateSession(payload.sessionId);
		if (
			session.userId !== payload.userId ||
			session.identityId !== payload.identityId ||
			session.visitorId !== payload.visitorId
		) {
			throw new UnauthorizedException('Session mismatch');
		}

		return {
			userId: payload.userId,
			identityId: payload.identityId,
			visitorId: payload.visitorId,
			sessionId: payload.sessionId,
			tenantId: session.tenantId,
		};
	}
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, TOKEN_TYPE.REFRESH) {
	constructor(private readonly sessionService: SessionService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: env.JWT_SECRET,
			algorithms: ['HS256'],
		});
	}

	async validate(payload: SessionTokenPayload): Promise<AuthContext> {
		if (payload.tokenType !== 'refresh') {
			throw new UnauthorizedException('Invalid token type');
		}

		const session = await this.sessionService.validateSession(payload.sessionId);
		if (
			session.userId !== payload.userId ||
			session.identityId !== payload.identityId ||
			session.visitorId !== payload.visitorId
		) {
			throw new UnauthorizedException('Session mismatch');
		}

		return {
			userId: payload.userId,
			identityId: payload.identityId,
			visitorId: payload.visitorId,
			sessionId: payload.sessionId,
			tenantId: session.tenantId,
		};
	}
}

@Injectable()
export class VisitorTokenStrategy extends PassportStrategy(Strategy, TOKEN_TYPE.VISITOR) {
	constructor(private readonly visitorService: VisitorService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: env.JWT_SECRET,
			algorithms: ['HS256'],
		});
	}

	async validate(payload: { tokenType?: string; visitorId?: string }) {
		if (payload.tokenType !== 'visitor' || !payload.visitorId) {
			throw new UnauthorizedException('Invalid visitor token');
		}

		const visitor = await this.visitorService.getVisitorById(payload.visitorId);
		if (!visitor) {
			throw new UnauthorizedException('Visitor not found');
		}

		return {
			tokenType: 'visitor' as const,
			visitorId: visitor.id,
		};
	}
}
