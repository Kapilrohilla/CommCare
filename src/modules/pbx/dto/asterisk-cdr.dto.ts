import z from 'zod';

export const AsteriskCdrWebhookPayload = z.object({
	event: z.string(),
	call: z.record(z.string(),z.unknown()),
	cdrs: z.array(z.record(z.string(), z.unknown())),
	events: z.array(z.record(z.string(), z.unknown())),
	receivedAt: z.string(),
});

export type AsteriskCdrWebhookPayload = z.infer<typeof AsteriskCdrWebhookPayload>;

/** @deprecated Use AsteriskCdrWebhookPayload */
export type AsteriskCdrEvent = AsteriskCdrWebhookPayload;
