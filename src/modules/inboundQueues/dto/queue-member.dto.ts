import z from 'zod';

export const CreateQueueMemberDto = z
	.object({
		agentId: z.string().uuid(),
		priority: z.number().int().min(0).optional(),
		penalty: z.number().int().min(0).optional(),
		enabled: z.boolean().optional(),
	})
	.strict();

export type CreateQueueMemberDto = z.infer<typeof CreateQueueMemberDto>;
