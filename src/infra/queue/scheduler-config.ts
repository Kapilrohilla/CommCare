import { Events } from '../../constants/event.constant';

/**
 * Scheduler Configuration
 * Define scheduled jobs that fire Kafka events
 *
 * Flow: BullMQ Scheduler → Kafka Event → Normal processing flow
 */

export interface SchedulerConfig {
  /** Unique name for this scheduled job */
  name: string;
  /** Event to fire when schedule triggers */
  eventName: string;
  /** Cron expression (e.g., '0 * * * *' for every hour) */
  cron?: string;
  /** Repeat every X milliseconds (alternative to cron) */
  every?: number;
  /** Payload to send with the event */
  payload?: Record<string, unknown>;
  /** Enable/disable this schedule (default: true) */
  enabled?: boolean;
  /** Timezone for cron (default: UTC) */
  timezone?: string;
  /** Maximum number of times to repeat (undefined = forever) */
  limit?: number;
}

/**
 * All scheduled jobs configuration
 * Add new schedules here to register them automatically
 */
export const SCHEDULER_CONFIGS: SchedulerConfig[] = [
  // Health check every 5 minutes
  {
    name: 'scheduled-health-check',
    eventName: Events.healthCheckPerformed,
    every: 300000, // 5 minutes = 5 * 60 * 1000 milliseconds
    payload: { source: 'scheduler', type: 'periodic', timestamp: new Date().toISOString() },
    enabled: true,
  },
];

/**
 * Get enabled scheduler configurations
 */
export function getEnabledSchedulerConfigs(): SchedulerConfig[] {
  return SCHEDULER_CONFIGS.filter((config) => config.enabled !== false);
}