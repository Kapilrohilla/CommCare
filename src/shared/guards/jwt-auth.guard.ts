import {
	ExecutionContext,
	ForbiddenException,
	Injectable,
	Logger,
	UseGuards,
	applyDecorators,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { TOKEN_TYPE, TokenType } from 'src/constants/tokenConstants';
import { ClsService } from 'src/shared/context/cls.service';
import { REQUIRE_TENANT_KEY } from '../decorators/auth.decorator';
import type { AuthContext } from '../types/auth.types';

/**
 * @JwtAuthGuard(TOKEN_TYPE.ACCESS)   — access tokens only
 * @JwtAuthGuard(TOKEN_TYPE.REFRESH)  — refresh tokens only
 * @JwtAuthGuard(TOKEN_TYPE.VISITOR)  — visitor tokens only
 */
export function JwtAuthGuard(tokenType: TokenType) {
	if (tokenType === TOKEN_TYPE.ACCESS) {
		return applyDecorators(UseGuards(AccessTokenGuard));
	}
	if (tokenType === TOKEN_TYPE.REFRESH) {
		return applyDecorators(UseGuards(RefreshTokenGuard));
	}
	if (tokenType === TOKEN_TYPE.VISITOR) {
		return applyDecorators(UseGuards(VisitorTokenGuard));
	}

	Logger.error('Invalid Token Type provided');
	throw new Error(`Invalid token type provided: ${tokenType}`);
}

function attachAuthToRequest(context: ExecutionContext, user: unknown) {
	const request = context.switchToHttp().getRequest<{ user?: unknown; auth?: AuthContext }>();
	request.user = user;
	if (user && typeof user === 'object' && 'sessionId' in user) {
		request.auth = user as AuthContext;
	}
}

@Injectable()
export class AccessTokenGuard extends AuthGuard(TOKEN_TYPE.ACCESS) {
	constructor(
		private readonly reflector: Reflector,
		private readonly clsService: ClsService,
	) {
		super();
	}

	canActivate(context: ExecutionContext) {
		return super.canActivate(context);
	}

	handleRequest<TUser = AuthContext>(
		err: unknown,
		user: TUser,
		info: unknown,
		context: ExecutionContext,
	): TUser {
		const auth = super.handleRequest(err, user, info, context) as AuthContext;

		const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (requireTenant && !auth.tenantId) {
			throw new ForbiddenException('Tenant setup required before accessing this resource');
		}

		attachAuthToRequest(context, auth);
		this.clsService.set('userId', auth.userId);
		this.clsService.set('tenantId', auth.tenantId);
		this.clsService.set('sessionId', auth.sessionId);
		this.clsService.set('identityId', auth.identityId);
		this.clsService.set('visitorId', auth.visitorId);

		return auth as TUser;
	}
}

@Injectable()
export class RefreshTokenGuard extends AuthGuard(TOKEN_TYPE.REFRESH) {
	canActivate(context: ExecutionContext) {
		return super.canActivate(context);
	}

	handleRequest<TUser = AuthContext>(
		err: unknown,
		user: TUser,
		info: unknown,
		context: ExecutionContext,
	): TUser {
		const auth = super.handleRequest(err, user, info, context);
		attachAuthToRequest(context, auth);
		return auth;
	}
}

@Injectable()
export class VisitorTokenGuard extends AuthGuard(TOKEN_TYPE.VISITOR) {
	canActivate(context: ExecutionContext) {
		return super.canActivate(context);
	}

	handleRequest<TUser = unknown>(
		err: unknown,
		user: TUser,
		info: unknown,
		context: ExecutionContext,
	): TUser {
		const visitor = super.handleRequest(err, user, info, context);
		attachAuthToRequest(context, visitor);
		return visitor;
	}
}
