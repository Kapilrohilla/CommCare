const SENSITIVE_KEYS = new Set([
	'password',
	'secret',
	'token',
	'authorization',
	'apikey',
	'api_key',
	'access_key',
	'secret_access_key',
	'refresh_token',
	'ami_secret',
]);

const MAX_PAYLOAD_LENGTH = 4096;

function isSensitiveKey(key: string): boolean {
	const normalized = key.toLowerCase().replace(/[-_]/g, '');
	return (
		SENSITIVE_KEYS.has(key.toLowerCase()) ||
		normalized.includes('password') ||
		normalized.includes('secret') ||
		normalized.includes('token')
	);
}

export function sanitizePayload(value: unknown, depth = 0): unknown {
	if (depth > 6) {
		return '[truncated: max depth]';
	}

	if (value === null || value === undefined) {
		return value;
	}

	if (typeof value === 'string') {
		return value.length > MAX_PAYLOAD_LENGTH
			? `${value.slice(0, MAX_PAYLOAD_LENGTH)}…`
			: value;
	}

	if (typeof value !== 'object') {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitizePayload(item, depth + 1));
	}

	const sanitized: Record<string, unknown> = {};
	for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
		sanitized[key] = isSensitiveKey(key) ? '[redacted]' : sanitizePayload(nestedValue, depth + 1);
	}

	return sanitized;
}

export function serializePayload(value: unknown): string {
	const sanitized = sanitizePayload(value);
	const serialized = JSON.stringify(sanitized ?? null);

	if (serialized.length <= MAX_PAYLOAD_LENGTH) {
		return serialized;
	}

	return `${serialized.slice(0, MAX_PAYLOAD_LENGTH)}…`;
}
