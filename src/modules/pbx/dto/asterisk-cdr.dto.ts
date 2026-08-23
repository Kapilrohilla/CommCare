import z from 'zod';

export const AsteriskCdrWebhookPayload = z.object({
	event: z.string(),
	raw: z.array(z.record(z.string(), z.string())).min(1),
	receivedAt: z.string(),
});

export type AsteriskCdrWebhookPayload = z.infer<typeof AsteriskCdrWebhookPayload>;

/** @deprecated Use AsteriskCdrWebhookPayload */
export type AsteriskCdrEvent = AsteriskCdrWebhookPayload;
