import z from 'zod';

export const CreateIvrDto = z
	.object({
		description: z.string().min(1).max(500),
		announcementRecordingId: z.string().uuid().optional(),
	})
	.strict();

export const UpdateIvrDto = z
	.object({
		description: z.string().min(1).max(500).optional(),
		announcementRecordingId: z.string().uuid().nullable().optional(),
	})
	.strict();

export type CreateIvrDto = z.infer<typeof CreateIvrDto>;
export type UpdateIvrDto = z.infer<typeof UpdateIvrDto>;
