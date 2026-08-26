/**
 * Event Constants
 * Define all event/topic names used in the application
 * Used by both Kafka and BullMQ
 *
 * Only add events here when they are actually used in the codebase
 */
export const Events = {
	healthCheckPerformed: 'healthCheckPerformed',
	cdrEvent: 'cdrEvent',
	extensionCreate: 'extensionCreate',
	bulkExtensionAssignment: 'bulkExtensionAssignment',
};