import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalizes a phone number to E.164 (e.g. "+14155551234"). The input must
 * include a country calling code (a leading "+", or the digits of one, e.g.
 * "14155551234") — a bare national number is ambiguous across countries and
 * is rejected (null) rather than guessing a default region. Never throws, so
 * callers can decide how to react (reject on write, treat as "no match" on
 * call resolution).
 */
export function normalizeToE164(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) {
		return null;
	}

	const parsed = parsePhoneNumberFromString(
		trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/\D/g, '')}`,
	);

	return parsed?.isValid() ? parsed.number : null;
}
