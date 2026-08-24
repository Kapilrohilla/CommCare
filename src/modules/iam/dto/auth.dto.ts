import z from 'zod';
import { IdentifierType } from '../constants/identity.constant';
import { VisitorAppType, VisitorIdentifierType } from '../constants/visitor.constant';

export const CreateVisitorDto = z.object({
	identifier: z.string().min(1).max(255),
	identifierType: z.nativeEnum(VisitorIdentifierType),
	appType: z.nativeEnum(VisitorAppType),
	userAgent: z.string().max(500).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SendOtpDto = z.object({
	identifier: z.string().min(1).max(255),
	identifierType: z.nativeEnum(IdentifierType),
});

export const VerifyOtpDto = z.object({
	identifier: z.string().min(1).max(255),
	identifierType: z.nativeEnum(IdentifierType),
	otp: z.string().length(6).regex(/^\d+$/),
	name: z.string().min(1).max(255).optional(),
});

export const CreateUserDto = z.object({
	identifier: z.string().min(1).max(255),
	identifierType: z.nativeEnum(IdentifierType),
	name: z.string().min(1).max(255),
});

export const CreateTenantDto = z.object({
	name: z.string().min(1).max(255),
});

export type CreateVisitorDto = z.infer<typeof CreateVisitorDto>;
export type SendOtpDto = z.infer<typeof SendOtpDto>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpDto>;
export type CreateUserDto = z.infer<typeof CreateUserDto>;
export type CreateTenantDto = z.infer<typeof CreateTenantDto>;
