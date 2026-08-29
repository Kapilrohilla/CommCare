import { z} from "zod";

const callOriginateSchema = z.object({
	from: z.string().min(3),
	to: z.string().min(3),
}).strict()

export type CallOriginateDto = z.infer<typeof callOriginateSchema>;
