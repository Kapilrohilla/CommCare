import { WebhookRegistryEventTrigger } from '../constants/webhook.constant';
import { WebhookRegistry } from '../entity/webhook.entity';

export interface Click2CallWebhookData {
	callId: string;
	callerNumber: string | null;
	callToNumber: string | null;
	status: string;
	direction: string;
	workflow: string;
	channelId?: string | null;
	bridgeId?: string | null;
	legRole?: 'agent' | 'callee' | null;
	hangupCause?: number | null;
	hangupCauseText?: string | null;
	occurredAt: string;
}

export interface SystemRecordingWebhookData {
	recordingId: string;
	name: string;
	sourceType: string | null;
	status: string;
	format: string | null;
	duration: number | null;
	errorMessage: string | null;
	occurredAt: string;
}

export type WebhookEventData = Click2CallWebhookData | SystemRecordingWebhookData;

export interface WebhookFanoutPayload {
	eventTrigger: WebhookRegistryEventTrigger;
	tenantId: string;
	data: WebhookEventData;
}

export interface WebhookDeliveryPayload {
	webhookRegistry: WebhookRegistry;
	eventTrigger: WebhookRegistryEventTrigger;
	body: WebhookDeliveryBody;
}

export interface WebhookDeliveryBody {
	event: WebhookRegistryEventTrigger;
	tenantId: string;
	timestamp: string;
	data: WebhookEventData;
}

export interface WebhookDeliveryResult {
	statusCode: number;
	body: unknown;
}
