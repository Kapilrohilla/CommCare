export enum WebhookRegistryEventTrigger {
	/**
	 * Click2Call events
	 */
	Click2CallCalleeConnected = 'Click2Call.CalleeConnected',
	Click2CallCalleeDisconnected = 'Click2Call.CalleeDisconnected',
	Click2CallCallerConnected = 'Click2Call.CallerConnected',
	Click2CallCallerDisconnected = 'Click2Call.CallerDisconnected',
	Click2CallCallerNoAnswer = 'Click2Call.CallerNoAnswer',
	Click2CallCalleeNoAnswer = 'Click2Call.CalleeNoAnswer',
}

export enum WebhookRegistryMethod{
	GET = 'get',
	POST = 'post',
	PUT = 'put',
	DELETE = 'delete',
	PATCH = 'patch',
}

export enum WebhookRegistryStatus{
	ACTIVE = 'active',
	INACTIVE = 'inactive',
	BLOCKED= 'blocked',
}