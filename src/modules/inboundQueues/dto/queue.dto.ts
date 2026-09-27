import z from 'zod';
import {
	MAX_MAX_WAIT_TIME_SECONDS,
	MAX_RING_TIMEOUT_SECONDS,
	MIN_MAX_WAIT_TIME_SECONDS,
	MIN_RING_TIMEOUT_SECONDS,
	QueueStrategy,
} from '../constants/queue.constant';

const QueueBaseSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(255).optional(),
	strategy: z.nativeEnum(QueueStrategy).optional(),
	ringTimeoutSeconds: z
		.number()
		.int()
		.min(MIN_RING_TIMEOUT_SECONDS)
		.max(MAX_RING_TIMEOUT_SECONDS)
		.optional(),
	maxWaitTimeSeconds: z
		.number()
		.int()
		.min(MIN_MAX_WAIT_TIME_SECONDS)
		.max(MAX_MAX_WAIT_TIME_SECONDS)
		.optional(),
	maxCallers: z.number().int().min(0).nullable().optional(),
	musicOnHoldId: z.string().uuid().nullable().optional(),
	enabled: z.boolean().optional(),
});

export const CreateQueueDto = QueueBaseSchema.strict();

export const UpdateQueueDto = QueueBaseSchema.partial().strict();

export type CreateQueueDto = z.infer<typeof CreateQueueDto>;
export type UpdateQueueDto = z.infer<typeof UpdateQueueDto>;
