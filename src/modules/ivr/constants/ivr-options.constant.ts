export enum IVROptionDestinationType {
	PHONE_NUMBER = 'PhoneNumber', // need to build flow for this
	IVR = 'IVR', // already have
	EXTENSION = 'Extension', // already have
	QUEUE = 'IB_Queue', // need to build flow for this
	HANGUP = 'hangup', // already have
	ANNOUNCEMENT = 'Announcement', // already have in sys recording
}

export const IVR_OPTION_DIGIT_PATTERN = /^[0-9*#]$/;
