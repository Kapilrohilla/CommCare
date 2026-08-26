type RequestHeaders = Record<string, string | string[] | undefined>;

const USER_AGENT_MAX_LENGTH = 500;

function getHeader(headers: RequestHeaders, name: string): string | undefined {
	const value = headers[name] ?? headers[name.toLowerCase()];
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}

function truncate(value: string | undefined, maxLength: number): string | null {
	if (!value) {
		return null;
	}
	return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export interface VisitorRequestContext {
	userAgent: string | null;
	metadata: Record<string, unknown> | null;
}

export function extractVisitorRequestContext(headers: RequestHeaders): VisitorRequestContext {
	const userAgent = truncate(getHeader(headers, 'user-agent'), USER_AGENT_MAX_LENGTH);

	const metadata: Record<string, unknown> = {};

	const forwardedFor = getHeader(headers, 'x-forwarded-for');
	const ip = forwardedFor?.split(',')[0]?.trim() ?? getHeader(headers, 'x-real-ip');
	if (ip) {
		metadata.ip = ip;
	}

	const acceptLanguage = getHeader(headers, 'accept-language');
	if (acceptLanguage) {
		metadata.acceptLanguage = acceptLanguage;
	}

	const referer = getHeader(headers, 'referer');
	if (referer) {
		metadata.referer = referer;
	}

	const origin = getHeader(headers, 'origin');
	if (origin) {
		metadata.origin = origin;
	}

	return {
		userAgent,
		metadata: Object.keys(metadata).length > 0 ? metadata : null,
	};
}
