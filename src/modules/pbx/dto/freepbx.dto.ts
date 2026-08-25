import z from 'zod';

export const CreateFreePbxExtensionDto = z.object({
	extension: z.string().min(1),
	name: z.string().optional(),
	secret: z.string().optional(),
	email: z.string().email().optional(),
});

export const CreateFreePbxExtensionRangeDto = z
	.object({
		startExtension: z.string().min(1).regex(/^\d+$/, 'startExtension must be numeric'),
		endExtension: z.string().min(1).regex(/^\d+$/, 'endExtension must be numeric'),
		namePrefix: z.string().optional(),
	})
	.refine((data) => Number(data.endExtension) >= Number(data.startExtension), {
		message: 'endExtension must be greater than or equal to startExtension',
	});

export const UpdateFreePbxExtensionDto = z.object({
	name: z.string().optional(),
	secret: z.string().optional(),
	email: z.string().email().optional(),
});

export type CreateFreePbxExtensionDto = z.infer<typeof CreateFreePbxExtensionDto>;
export type CreateFreePbxExtensionRangeDto = z.infer<typeof CreateFreePbxExtensionRangeDto>;
export type UpdateFreePbxExtensionDto = z.infer<typeof UpdateFreePbxExtensionDto>;
