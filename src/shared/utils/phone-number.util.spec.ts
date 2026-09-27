import { normalizeToE164 } from './phone-number.util';

describe('normalizeToE164', () => {
	it('accepts an already-E.164 US number', () => {
		expect(normalizeToE164('+14155551234')).toBe('+14155551234');
	});

	it('normalizes digits-only input that already includes a country calling code', () => {
		expect(normalizeToE164('14155551234')).toBe('+14155551234');
	});

	it('normalizes an international number with punctuation and a leading +', () => {
		expect(normalizeToE164('+91 11 4000 1234')).toBe('+911140001234');
	});

	it('returns null for an empty string', () => {
		expect(normalizeToE164('   ')).toBeNull();
	});

	it('returns null for a bare national number with no country calling code (ambiguous)', () => {
		expect(normalizeToE164('4155551234')).toBeNull();
		expect(normalizeToE164('(415) 555-1234')).toBeNull();
	});

	it('returns null for an unparseable/invalid number', () => {
		expect(normalizeToE164('not-a-number')).toBeNull();
		expect(normalizeToE164('123')).toBeNull();
	});
});
