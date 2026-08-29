import { AsteriskCDRService } from 'src/modules/pbx/services/asterisk-cdr.service';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { Events } from '../../constants/event.constant';
import { HealthCheckService } from '../../modules/healthCheck/services/healthCheck.service';
import { TenancyExtensionService } from 'src/modules/tenancy/services/tenancy-extension.service';
/**
 * Subscriber Configuration
 * Centralized configuration for event subscribers
 *
 * Architecture:
 * - All events are published to Kafka
 * - All events are processed by BullMQ workers (via Kafka)
 *
 * Flow: Producer → Kafka → KafkaConsumer → BullMQ Worker → Handler
 *
 * This provides:
 * - Durability & ordering via Kafka
 * - Retry, concurrency, monitoring via BullMQ
 * - All jobs visible in Bull Board UI
 */

export interface SubscriberConfig {
  /** Event name from Events */
  eventName: string;
  /** Service class that handles this event */
  serviceClass: new (...args: unknown[]) => unknown;
  /** Name identifier for the subscriber service */
  subscriberServiceName: string;
  /** Kafka consumer group ID (optional, uses default if not specified) */
  groupId?: string;
  /** Enable retry on failure (default: true) */
  retry?: boolean;
  /** Delay in milliseconds before processing */
  delay?: number;
  /** BullMQ worker concurrency (default: 5) */
  concurrency?: number;
  /** BullMQ rate limiter — { max: jobs, duration: ms } e.g. { max: 60, duration: 60_000 } for 60 jobs/min */
  limiter?: { max: number; duration: number };
  /** Max BullMQ job attempts before moving to DLQ (default: 10) */
  maxAttempts?: number;
}

/**
 * Default values for subscriber configuration
 */
export const SUBSCRIBER_DEFAULTS = {
  retry: true,
} as const;

/**
 * Apply default values to a subscriber configuration
 */
export function applyDefaults(config: SubscriberConfig): Required<Pick<SubscriberConfig, 'retry'>> & SubscriberConfig {
  return {
    ...config,
    retry: config.retry ?? SUBSCRIBER_DEFAULTS.retry,
  };
}

/**
 * All subscriber configurations
 * Add new subscriptions here to register them automatically
 *
 * All events flow: Kafka → BullMQ Worker → Handler
 */
export const SUBSCRIBER_CONFIGS: SubscriberConfig[] = [
  // Health module subscribers
  {
    eventName: Events.healthCheckPerformed,
    serviceClass: HealthCheckService,
    subscriberServiceName: 'healthService',
  },
  {
    eventName: Events.cdrEvent,
    serviceClass: AsteriskCDRService,
    subscriberServiceName: 'asteriskCDRService',
    concurrency: 10,
  },
  {
    eventName: Events.extensionCreate,
    serviceClass: ExtensionService,
    subscriberServiceName: 'extensionService',
    // TODO: currently cann't support concurrency need to look into other possibilities
    concurrency: 1,
    limiter: { max: 10, duration: 60_000 },
  },
  {
    eventName: Events.bulkExtensionAssignment,
    serviceClass: TenancyExtensionService,
    subscriberServiceName: 'tenancyExtensionService',
    concurrency: 10,
    limiter: { max: 10, duration: 60_000 },
  },
  {
    eventName: Events.extensionPoolMaintenance,
    serviceClass: ExtensionService,
    subscriberServiceName: 'extensionService',
    concurrency: 1,
  },
];

/**
 * Get subscriber configurations grouped by event name
 */
export function getSubscriberConfigsByEvent(): Map<string, SubscriberConfig[]> {
  const grouped = new Map<string, SubscriberConfig[]>();

  for (const config of SUBSCRIBER_CONFIGS) {
    const existing = grouped.get(config.eventName) || [];
    existing.push(applyDefaults(config));
    grouped.set(config.eventName, existing);
  }

  return grouped;
}