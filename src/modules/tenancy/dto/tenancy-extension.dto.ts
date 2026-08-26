import z from 'zod';
import { MIN_AVAILABLE_EXTENSION_THRESHOLD } from 'src/modules/pbx/constants/extension.constant';

export const RegisterExtensionToTenantDto = z.object({
	count: z.number().int().min(1).max(MIN_AVAILABLE_EXTENSION_THRESHOLD - 1),
});

export const UnassignExtensionDto = z.object({
	extensionId: z.string().uuid(),
});

export const UnregisterExtensionToTenantDto = z.object({
	extensionId: z.string().uuid(),
});

export const CreateTenantUserDto = z.object({
	name: z.string().min(1).max(255),
	extensionIds: z.array(z.string().uuid()).min(1),
});

export const UpdateTenantUserDto = z.object({
	name: z.string().min(1).max(255),
});

export const AssignExtensionsToUserDto = z.object({
	userId: z.string().uuid(),
	extensionIds: z.array(z.string().uuid()).min(1),
});

export type RegisterExtensionToTenantDto = z.infer<typeof RegisterExtensionToTenantDto>;
export type UnassignExtensionDto = z.infer<typeof UnassignExtensionDto>;
export type UnregisterExtensionToTenantDto = z.infer<typeof UnregisterExtensionToTenantDto>;
export type CreateTenantUserDto = z.infer<typeof CreateTenantUserDto>;
export type UpdateTenantUserDto = z.infer<typeof UpdateTenantUserDto>;
export type AssignExtensionsToUserDto = z.infer<typeof AssignExtensionsToUserDto>;

export interface BulkExtensionAssignmentEventPayload {
	tenantId: string;
	count: number;
}
