import { z } from 'zod';
import {
	CallDirection,
	CallStatus,
	CallWorkflow,
} from '../constants/call.constant';

export const CallOriginateDto = z
	.object({
		fromNumber: z.string().min(3),
		toNumber: z.string().min(3),
		type: z.enum(['internal', 'external']).default('internal'),
	})
	.strict();

export const DialSessionDto = z
	.object({
		startOrEnd: z.enum(['start', 'end']).default('start'),
		extensionId: z.string().min(3),
	})
	.strict();

export const ListCallsQueryDto = z
	.object({
		from: z.string().min(1).optional(),
		to: z.string().min(1).optional(),
		direction: z.nativeEnum(CallDirection).optional(),
		workflow: z.nativeEnum(CallWorkflow).optional(),
		status: z.nativeEnum(CallStatus).optional(),
		agentExtension: z.string().min(1).optional(),
		number: z.string().min(1).optional(),
		limit: z.coerce.number().int().min(1).max(100).default(50),
		offset: z.coerce.number().int().min(0).default(0),
	})
	.strict();

export type CallOriginateDto = z.infer<typeof CallOriginateDto>;
export type DialSessionDto = z.infer<typeof DialSessionDto>;
export type ListCallsQueryDto = z.infer<typeof ListCallsQueryDto>;
