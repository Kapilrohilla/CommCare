import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { env } from 'src/config/env.config';
import { JwtPayload, SessionTokenPayload, VisitorTokenPayload } from 'src/shared/types/auth.types';

@Injectable()
export class JwtService {
	private static readonly visitorTokenExpiresIn = '365d';
	private static readonly refreshTokenExpiresIn = '30d';
	private static readonly accessTokenExpiresIn = '15m';
	private static readonly jwtAlgorithm = 'HS256';

	private readonly jwtSecret: string;

	constructor() {
		this.jwtSecret = env.JWT_SECRET;
	}

	async generateVisitorToken(visitorId: string): Promise<string> {
		const claims: VisitorTokenPayload = {
			tokenType: 'visitor',
			visitorId,
		};
		return this.sign(claims, { expiresIn: JwtService.visitorTokenExpiresIn });
	}

	async generateRefreshToken(
		userId: string,
		identityId: string,
		visitorId: string,
		sessionId: string,
		tenantId: string | null,
	): Promise<string> {
		const claims: SessionTokenPayload = {
			tokenType: 'refresh',
			userId,
			identityId,
			visitorId,
			sessionId,
			tenantId,
		};
		return this.sign(claims, { expiresIn: JwtService.refreshTokenExpiresIn });
	}

	async generateAccessToken(
		userId: string,
		identityId: string,
		visitorId: string,
		sessionId: string,
		tenantId: string | null,
	): Promise<string> {
		const claims: SessionTokenPayload = {
			tokenType: 'access',
			userId,
			identityId,
			visitorId,
			sessionId,
			tenantId,
		};
		return this.sign(claims, { expiresIn: JwtService.accessTokenExpiresIn });
	}

	async verifyToken(token: string): Promise<JwtPayload> {
		return jwt.verify(token, this.jwtSecret, {
			algorithms: [JwtService.jwtAlgorithm],
		}) as JwtPayload;
	}

	getRefreshTokenExpiryMs(): number {
		return 30 * 24 * 60 * 60 * 1000;
	}

	private sign(payload: object, options: jwt.SignOptions): Promise<string> {
		return new Promise((resolve, reject) => {
			jwt.sign(payload, this.jwtSecret, { algorithm: JwtService.jwtAlgorithm, ...options }, (err, token) => {
				if (err || !token) {
					reject(err ?? new Error('Failed to sign JWT'));
					return;
				}
				resolve(token);
			});
		});
	}
}
