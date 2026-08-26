import z from 'zod';

export const CreateTenancyDto = z.object({
	name: z.string().min(1).max(255),
});

export const UpdateTenancyDto = z.object({
	name: z.string().min(1).max(255),
});

export type CreateTenancyDto = z.infer<typeof CreateTenancyDto>;
export type UpdateTenancyDto = z.infer<typeof UpdateTenancyDto>;
