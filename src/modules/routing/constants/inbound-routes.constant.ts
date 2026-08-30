export enum InboundRouteSourceType {
	Extension = 'extension',
	PhoneNumber = "phone_number",
	FeatureCode = "feature_code"
}

export enum InboundRouteDestinationType {
	Extension = 'extension',
	Queue = 'queue',
	IVR = 'ivr',
	ExternalNumber = 'external_number',
	Voicemail = 'voicemail',
	Hangup = 'hangup'
}