import z from 'zod';

export const RawKeyQueryDto = z.object({
	key: z.string().min(1),
	cacheName: z.string().optional(),
});

export const RawKeySetDto = z.object({
	value: z.string(),
	ttl: z.number().int().positive().optional(),
});

export type RawKeyQueryDto = z.infer<typeof RawKeyQueryDto>;
export type RawKeySetDto = z.infer<typeof RawKeySetDto>;
