import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthContext, VisitorContext } from '../types/auth.types';

export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
	const request = ctx.switchToHttp().getRequest<{ auth: AuthContext; user: AuthContext }>();
	return request.auth ?? request.user;
});

export const CurrentVisitor = createParamDecorator((_data: unknown, ctx: ExecutionContext): VisitorContext => {
	const request = ctx.switchToHttp().getRequest<{ user: VisitorContext }>();
	return request.user;
});
