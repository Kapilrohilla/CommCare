import { z} from "zod";

export const CallOriginateDto = z.object({
	fromNumber: z.string().min(3),
	toNumber: z.string().min(3),
	type: z.enum(['internal', 'external']).default('internal'),
}).strict()

export type CallOriginateDto = z.infer<typeof CallOriginateDto>;
