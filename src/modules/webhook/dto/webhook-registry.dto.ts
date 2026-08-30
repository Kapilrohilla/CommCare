import z from "zod";
import { WebhookRegistryEventTrigger, WebhookRegistryMethod } from "../constants/webhook.constant";

export const CreateWebhookRegistryDto = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	endpoint: z.string().min(1),
	headers: z.record(z.string(), z.string()).optional(),
	method: z.nativeEnum(WebhookRegistryMethod),
	triggerEvent: z.nativeEnum(WebhookRegistryEventTrigger),
});

export const UpdateWebhookRegistryDto = z.object({
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	endpoint: z.string().min(1).optional(),
	headers: z.record(z.string(), z.string()).optional(),
	method: z.nativeEnum(WebhookRegistryMethod).optional(),
	triggerEvent: z.nativeEnum(WebhookRegistryEventTrigger).optional(),
});

export type CreateWebhookRegistryDto = z.infer<typeof CreateWebhookRegistryDto>;
export type UpdateWebhookRegistryDto= z.infer<typeof UpdateWebhookRegistryDto>;