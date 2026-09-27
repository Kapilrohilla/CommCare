import z from 'zod';
import { PhoneNumberStatus, PhoneNumberType } from '../constants/phone-number.constant';

export const CreatePhoneNumberDto = z
	.object({
		sipTrunkId: z.string().uuid(),
		number: z.string().trim().min(1).max(20),
		type: z.nativeEnum(PhoneNumberType).optional(),
		status: z.nativeEnum(PhoneNumberStatus).optional(),
		name: z.string().trim().min(1).max(128),
		description: z.string().trim().max(255).nullable().optional(),
	})
	.strict();

export type CreatePhoneNumberDto = z.infer<typeof CreatePhoneNumberDto>;

export const UpdatePhoneNumberDto = z
	.object({
		sipTrunkId: z.string().uuid().optional(),
		number: z.string().trim().min(1).max(20).optional(),
		type: z.nativeEnum(PhoneNumberType).optional(),
		status: z.nativeEnum(PhoneNumberStatus).optional(),
		name: z.string().trim().min(1).max(128).optional(),
		description: z.string().trim().max(255).nullable().optional(),
	})
	.strict();

export type UpdatePhoneNumberDto = z.infer<typeof UpdatePhoneNumberDto>;
