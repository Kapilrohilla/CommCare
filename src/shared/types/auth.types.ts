export type JwtTokenType = 'visitor' | 'access' | 'refresh';

export interface VisitorTokenPayload {
	tokenType: 'visitor';
	visitorId: string;
}

export interface SessionTokenPayload {
	tokenType: 'access' | 'refresh';
	userId: string;
	identityId: string;
	visitorId: string;
	sessionId: string;
	tenantId: string | null;
}

export type JwtPayload = VisitorTokenPayload | SessionTokenPayload;

export interface AuthContext {
	userId: string;
	identityId: string;
	visitorId: string;
	sessionId: string;
	tenantId: string | null;
}

export interface VisitorContext {
	tokenType: 'visitor';
	visitorId: string;
}

export type AuthenticatedUser = AuthContext | VisitorContext;

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
	sessionId: string;
	expiresAt: string;
}

export interface AccessTokenResponse {
	accessToken: string;
}
