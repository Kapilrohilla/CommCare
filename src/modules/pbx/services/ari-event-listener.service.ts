import { Injectable, Logger } from '@nestjs/common';
import { AriCallEventPayload } from '../types/ari-event.types';

@Injectable()
export class AriEventListenerService {
	private readonly logger = new Logger(AriEventListenerService.name);

	async handleEventAriCallEvent(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const data = payload as AriCallEventPayload;
		this.logger.log(
			`[${eventName}] retry=${retryCount} partitionKey=${data?.partitionKey} body=${JSON.stringify(data?.body ?? payload)}`,
		);
	}
}
