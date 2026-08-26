import z from 'zod';
import { ExtensionStatus, ExtensionType } from '../constants/extension.constant';

const extensionTypeValues = [ExtensionType.USER] as const;
const extensionStatusValues = [
	ExtensionStatus.AVAILABLE,
	ExtensionStatus.RESERVED,
	ExtensionStatus.ASSIGNED,
	ExtensionStatus.DISABLED,
] as const;

export const CreateExtensionDto = z.object({
	description: z.string().optional(),
	callerIdName: z.string().optional(),
	type: z.enum(extensionTypeValues).optional(),
	status: z.enum(extensionStatusValues).optional(),
});

export const UpdateExtensionDto = z.object({
	description: z.string().optional(),
	callerIdName: z.string().optional(),
	callerIdNumber: z.string().optional(),
	status: z.enum(extensionStatusValues).optional(),
	pjsipPassword: z.string().optional(),
});

export const BulkCreateExtensionDto = CreateExtensionDto.extend({
	count: z.number().int().min(1).max(100),
});

export const ExtensionCreateEventPayload = z.object({
	batchId: z.string().uuid(),
	index: z.number().int().nonnegative(),
	tenantId: z.string().uuid(),
	description: z.string().optional(),
	callerIdName: z.string().optional(),
	type: z.enum(extensionTypeValues).optional(),
	status: z.enum(extensionStatusValues).optional(),
});

export type CreateExtensionDto = z.infer<typeof CreateExtensionDto>;
export type UpdateExtensionDto = z.infer<typeof UpdateExtensionDto>;
export type BulkCreateExtensionDto = z.infer<typeof BulkCreateExtensionDto>;
export type ExtensionCreateEventPayload = z.infer<typeof ExtensionCreateEventPayload>;

export type CreateExtensionInput = CreateExtensionDto & {
	tenantId: string;
};
