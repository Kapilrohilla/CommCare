import z from 'zod';

export const CreateGlobalConfigDto = z
	.object({
		key: z.string().min(1).max(255),
		value: z.record(z.string(), z.unknown()),
		description: z.string().max(5000).optional(),
	})
	.strict();

export const UpdateGlobalConfigDto = z
	.object({
		key: z.string().min(1).max(255).optional(),
		value: z.record(z.string(), z.unknown()).optional(),
		description: z.string().max(5000).nullable().optional(),
	})
	.strict();

export type CreateGlobalConfigDto = z.infer<typeof CreateGlobalConfigDto>;
export type UpdateGlobalConfigDto = z.infer<typeof UpdateGlobalConfigDto>;
