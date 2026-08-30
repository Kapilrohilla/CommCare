import z from 'zod';
import { IVRSessionState } from '../constants/ivr-session.constant';
import { IVR_OPTION_DIGIT_PATTERN } from '../constants/ivr-options.constant';

export const CreateIvrSessionDto = z
	.object({
		callId: z.string().uuid(),
		ivrId: z.string().uuid(),
	})
	.strict();

export const UpdateIvrSessionDto = z
	.object({
		state: z.nativeEnum(IVRSessionState).optional(),
		lastDigit: z
			.string()
			.regex(IVR_OPTION_DIGIT_PATTERN, 'lastDigit must be 0-9, *, or #')
			.nullable()
			.optional(),
		invalidAttempts: z.number().int().min(0).optional(),
		timeoutAttempts: z.number().int().min(0).optional(),
	})
	.strict();

export type CreateIvrSessionDto = z.infer<typeof CreateIvrSessionDto>;
export type UpdateIvrSessionDto = z.infer<typeof UpdateIvrSessionDto>;
