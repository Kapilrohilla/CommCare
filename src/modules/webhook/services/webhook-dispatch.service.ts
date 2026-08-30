import { Injectable, Logger } from '@nestjs/common';
import got from 'got';
import { WebhookRegistryService } from './webhook-registry.service';
import {
	WebhookRegistryEventTrigger,
	WebhookRegistryMethod,
	WebhookRegistryStatus,
} from '../constants/webhook.constant';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { Events } from 'src/constants/event.constant';
import { WebhookLogsService } from './webhook-logs.service';
import { WebhookLogs } from '../entity/webhook-logs.entity';
import { WebhookRegistry } from '../entity/webhook.entity';
import {
	Click2CallWebhookData,
	WebhookDeliveryBody,
	WebhookDeliveryPayload,
	WebhookDeliveryResult,
	WebhookFanoutPayload,
} from '../types/webhook-dispatch.types';

const WEBHOOK_DELIVERY_TIMEOUT_MS = 5_000;

@Injectable()
export class WebhookDispatcherService {
	private readonly logger = new Logger(WebhookDispatcherService.name);

	constructor(
		private readonly webhookRegistryService: WebhookRegistryService,
		private readonly eventProducer: EventProducer,
		private readonly webhookLogService: WebhookLogsService,
	) {}

	buildDeliveryBody(
		eventTrigger: WebhookRegistryEventTrigger,
		tenantId: string,
		data: Click2CallWebhookData,
	): WebhookDeliveryBody {
		return {
			event: eventTrigger,
			tenantId,
			timestamp: new Date().toISOString(),
			data,
		};
	}

	/** Publish a fanout job — resolved registries are enqueued for delivery asynchronously. */
	async enqueueWebhookFanout(
		eventTrigger: WebhookRegistryEventTrigger,
		tenantId: string,
		data: Click2CallWebhookData,
	): Promise<void> {
		const payload: WebhookFanoutPayload = { eventTrigger, tenantId, data };
		await this.eventProducer.publish(Events.webhookFanout, payload, {
			partitionKey: tenantId,
		});
	}

	async handleEventWebhookFanout(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const fanout = payload as WebhookFanoutPayload;
		if (!fanout?.eventTrigger || !fanout?.tenantId || !fanout?.data) {
			this.logger.warn(
				`Skipping ${eventName} (retry ${retryCount}): invalid fanout payload`,
			);
			return;
		}

		const registries =
			await this.webhookRegistryService.getActiveWebhookRegistriesByEventTrigger(
				fanout.eventTrigger,
				fanout.tenantId,
			);

		if (!registries.length) {
			this.logger.debug(
				`No active webhooks for ${fanout.eventTrigger} tenant ${fanout.tenantId}`,
			);
			return;
		}

		const body = this.buildDeliveryBody(
			fanout.eventTrigger,
			fanout.tenantId,
			fanout.data,
		);

		for (const webhookRegistry of registries) {
			const deliveryPayload: WebhookDeliveryPayload = {
				webhookRegistry,
				eventTrigger: fanout.eventTrigger,
				body,
			};

			await this.eventProducer.publish(Events.webhookDelivery, deliveryPayload, {
				partitionKey: webhookRegistry.id,
			});
		}

		this.logger.log(
			`Enqueued ${registries.length} webhook deliveries for ${fanout.eventTrigger}`,
		);
	}

	async handleEventWebhookDelivery(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const delivery = payload as WebhookDeliveryPayload;
		const webhookRegistry = delivery?.webhookRegistry;
		const body = delivery?.body;

		if (!webhookRegistry?.id || !webhookRegistry?.endpoint || !body) {
			this.logger.warn(
				`Skipping ${eventName} (retry ${retryCount}): invalid delivery payload`,
			);
			return;
		}

		if (webhookRegistry.status !== WebhookRegistryStatus.ACTIVE) {
			this.logger.debug(`Skipping inactive webhook ${webhookRegistry.id}`);
			return;
		}

		if (
			webhookRegistry.pauseWebhookAt &&
			webhookRegistry.pauseWebhookAt.getTime() > Date.now()
		) {
			this.logger.debug(`Skipping paused webhook ${webhookRegistry.id}`);
			return;
		}

		let result: WebhookDeliveryResult;
		try {
			result = await this.deliverWebhook(webhookRegistry, body);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await this.persistWebhookLog(webhookRegistry, body, {
				statusCode: 0,
				body: { error: message },
			});
			throw error;
		}

		await this.persistWebhookLog(webhookRegistry, body, result);

		if (result.statusCode < 200 || result.statusCode >= 300) {
			throw new Error(
				`Webhook ${webhookRegistry.id} returned HTTP ${result.statusCode}`,
			);
		}
	}

	private async deliverWebhook(
		webhookRegistry: WebhookRegistry,
		body: WebhookDeliveryBody,
	): Promise<WebhookDeliveryResult> {
		const method = webhookRegistry.method;
		const headers = {
			'Content-Type': 'application/json',
			...(webhookRegistry.headers ?? {}),
		};

		const response = await got(webhookRegistry.endpoint, {
			method,
			headers,
			timeout: { request: WEBHOOK_DELIVERY_TIMEOUT_MS },
			throwHttpErrors: false,
			...(method === WebhookRegistryMethod.GET
				? { searchParams: body as unknown as Record<string, string> }
				: { json: body }),
		});

		let parsedBody: unknown = response.body;
		try {
			parsedBody = JSON.parse(response.body);
		} catch {
			// keep raw body
		}

		return {
			statusCode: response.statusCode,
			body: parsedBody,
		};
	}

	private async persistWebhookLog(
		webhookRegistry: WebhookRegistry,
		body: WebhookDeliveryBody,
		result: WebhookDeliveryResult,
	): Promise<void> {
		const webhookLog = new WebhookLogs();
		webhookLog.webhookRegistryId = webhookRegistry.id;
		webhookLog.tenantId = webhookRegistry.tenantId;
		webhookLog.requestEndpoint = webhookRegistry.endpoint;
		webhookLog.requestMethod = webhookRegistry.method;
		webhookLog.requestHeaders = webhookRegistry.headers ?? {};
		webhookLog.requestPayload = body as unknown as Record<string, unknown>;
		webhookLog.responsePayload =
			typeof result.body === 'object' && result.body !== null
				? (result.body as Record<string, unknown>)
				: { body: result.body };
		webhookLog.responseStatusCode = result.statusCode;
		webhookLog.createdAt = new Date();

		await this.webhookLogService.createWebhookLog(webhookLog);
	}
}
