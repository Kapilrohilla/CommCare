export const GLOBAL_CONFIG_CACHE = {
	BY_ID: 'GlobalConfig:byId',
	BY_KEY: 'GlobalConfig:byKey',
} as const;

export const GLOBAL_CONFIG_KEYS = {
	DEFAULT_TTS_VENDOR: 'defaultTtsVendor',
} as const;

export const TTS_VENDOR = {
	AWS_POLLY: 'awsPolly',
} as const;

export type DefaultTtsVendorConfig = { vendor: string } | null;
