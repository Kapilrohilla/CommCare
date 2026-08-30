import { z} from "zod";

export const CallOriginateDto = z.object({
	fromNumber: z.string().min(3),
	toNumber: z.string().min(3),
	type: z.enum(['internal', 'external']).default('internal'),
}).strict()

export const DialSessionDto = z.object({
	startOrEnd: z.enum(['start', 'end']).default('start'),
	extensionId: z.string().min(3)
}).strict()

export type CallOriginateDto = z.infer<typeof CallOriginateDto>;
export type DialSessionDto = z.infer<typeof DialSessionDto>;
