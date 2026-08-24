import jwt from 'jsonwebtoken';
export class JwtService {

	private static readonly visitorTokenExpiresIn = '365 days';
	private static readonly refreshTokenExpiresIn = '30 days';
	private readonly jwtSecret : undefined | string= undefined;
	private static readonly jwtAlgorithm = 'HS256';
	private static readonly accessTokenExpiresIn = '15m'

	constructor(jwtSecret: string) {
		this.jwtSecret = jwtSecret;
	 }
	public async generateVisitorToken(visitorId: string): Promise<string> {
		const claims = {
			tokenType: 'visitor',
			visitorId: visitorId,
		};
		return await this.sign(claims, {
			expiresIn: this.visitorTokenExpiresIn
		});
	}

	public static async generateRefreshToken(userId: string, identityId: string, visitorId: string, sessionId: string): Promise<string> {
		const claims = {
			tokenType: "refresh",
			userId: userId,
			identityId: identityId,
			visitorId: visitorId,
			sessionId: sessionId,
		}

		return await this.sign(claims, {
			expiresIn: this.refreshTokenExpiresIn
		})
	}

	public static async generateAccessToken(userId: string, identityId: string, visitorId: string, sessionId: string): Promise<string> {
		const claims = {
			tokenType: 'access',
			userId: userId,
			identityId: identityId,
			visitorId: visitorId,
			sessionId: sessionId,
		}

		return await this.sign(claims, {
			expiresIn: this.accessTokenExpiresIn
		});
	}

	public static async generateIdToken(userId: string, identityId: string, visitorId: string, sessionId: string): Promise<string> {
		const claims = {
			tokenType: 'id',
			userId: userId,
			identityId: identityId,
			visitorId: visitorId,
			sessionId: sessionId,
		}
		return await this.sign(claims, {
			expiresIn: this.accessTokenExpiresIn
		});
	}

	private static async sign(payload: any, options: jwt.SignOptions): Promise<string> {
		if (!this.jwtSecret!) {
			throw new Error('JWT secret is not set');
		}
		return await jwt.sign(payload, this.jwtSecret, options);
	}

	private static async verify(token: string): Promise<any> {
		if (!this.jwtSecret!) {
			throw new Error('JWT secret is not set');
		}
		return await jwt.verify(token, this.jwtSecret);
	}
}