import { PjsipRealtimeRepository } from './pjsip-realtime.repository';

describe('PjsipRealtimeRepository trunk ids', () => {
	const trunkUuid = '550e8400-e29b-41d4-a716-446655440000';

	it('maps trunk uuid to endpoint id under 40 chars with trunk- prefix', () => {
		const endpointId = PjsipRealtimeRepository.trunkEndpointId(trunkUuid);
		expect(endpointId.startsWith('trunk-')).toBe(true);
		expect(endpointId.length).toBeLessThanOrEqual(40);
		expect(endpointId).toBe(`trunk-${trunkUuid.replace(/-/g, '')}`);
	});

	it('maps identify row ids deterministically', () => {
		expect(PjsipRealtimeRepository.trunkIdentifyId(trunkUuid, 0)).toBe(
			`i${trunkUuid.replace(/-/g, '')}00`,
		);
		expect(PjsipRealtimeRepository.trunkIdentifyId(trunkUuid, 1).length).toBeLessThanOrEqual(
			40,
		);
	});

	it('maps auth id from trunk uuid under 40 chars', () => {
		const authId = PjsipRealtimeRepository.trunkAuthId(trunkUuid);
		expect(authId).toBe(`ta${trunkUuid.replace(/-/g, '')}`);
		expect(authId.length).toBeLessThanOrEqual(40);
	});
});

describe('PjsipRealtimeRepository upsertTrunk / deleteTrunk', () => {
	it('writes endpoint, identify, and optional auth in a transaction then deletes them', async () => {
		const saved: unknown[] = [];
		const deleted: unknown[] = [];
		const manager = {
			delete: jest.fn(async (entity: unknown, criteria: unknown) => {
				deleted.push({ entity, criteria });
			}),
			save: jest.fn(async (entity: unknown, value: unknown) => {
				saved.push({ entity, value });
				return value;
			}),
			findOne: jest.fn(),
		};
		const postgresqlService = {
			getWriterDataSource: () => ({
				transaction: async (fn: (m: typeof manager) => Promise<void>) => fn(manager),
			}),
		};

		const repo = new PjsipRealtimeRepository(
			postgresqlService as never,
			{} as never,
			{} as never,
			{} as never,
		);

		const trunkUuid = '550e8400-e29b-41d4-a716-446655440000';
		const endpointId = PjsipRealtimeRepository.trunkEndpointId(trunkUuid);

		await repo.upsertTrunk(
			{
				endpointId,
				authMode: 'ip',
				identifyMatches: ['13.52.9.100'],
				enabled: true,
			},
			trunkUuid,
		);

		expect(manager.save).toHaveBeenCalled();
		expect(
			saved.some((entry) => {
				const row = entry as { value: { context?: string; auth?: string | null } };
				return Array.isArray(row.value)
					? false
					: row.value?.context === 'from-trunk' && row.value?.auth === null;
			}),
		).toBe(true);

		await repo.deleteTrunk(endpointId, trunkUuid);
		expect(deleted.length).toBeGreaterThan(0);
	});

	it('links auth row for credentials mode with endpoint id equal to username', async () => {
		const saved: { entity: unknown; value: unknown }[] = [];
		const deleted: { entity: unknown; criteria: unknown }[] = [];
		const manager = {
			delete: jest.fn(async (entity: unknown, criteria: unknown) => {
				deleted.push({ entity, criteria });
			}),
			save: jest.fn(async (entity: unknown, value: unknown) => {
				saved.push({ entity, value });
				return value;
			}),
			findOne: jest.fn(),
		};
		const repo = new PjsipRealtimeRepository(
			{
				getWriterDataSource: () => ({
					transaction: async (fn: (m: typeof manager) => Promise<void>) => fn(manager),
				}),
			} as never,
			{} as never,
			{} as never,
			{} as never,
		);

		const trunkUuid = '11111111-1111-1111-1111-111111111111';
		const username = 'trunkuser';

		await repo.upsertTrunk(
			{
				endpointId: username,
				authMode: 'credentials',
				username,
				password: 'secret',
				identifyMatches: [],
				enabled: true,
			},
			trunkUuid,
		);

		const authSave = saved.find((entry) => {
			const value = entry.value as { id?: string; username?: string; password?: string };
			return (
				value?.username === username &&
				value?.password === 'secret' &&
				value?.id === PjsipRealtimeRepository.trunkAuthId(trunkUuid)
			);
		});
		expect(authSave).toBeDefined();

		const endpointSave = saved.find((entry) => {
			const value = entry.value as { id?: string; auth?: string; context?: string; aors?: string };
			return (
				value?.id === username &&
				value?.aors === username &&
				value?.context === 'from-trunk' &&
				value?.auth === PjsipRealtimeRepository.trunkAuthId(trunkUuid)
			);
		});
		expect(endpointSave).toBeDefined();
	});

	it('deletes previous endpoint rows when credentials endpoint id changes', async () => {
		const deleted: { criteria: unknown }[] = [];
		const manager = {
			delete: jest.fn(async (_entity: unknown, criteria: unknown) => {
				deleted.push({ criteria });
			}),
			save: jest.fn(async (_entity: unknown, value: unknown) => value),
			findOne: jest.fn(),
		};
		const repo = new PjsipRealtimeRepository(
			{
				getWriterDataSource: () => ({
					transaction: async (fn: (m: typeof manager) => Promise<void>) => fn(manager),
				}),
			} as never,
			{} as never,
			{} as never,
			{} as never,
		);

		const trunkUuid = '22222222-2222-2222-2222-222222222222';
		const previousEndpointId = PjsipRealtimeRepository.trunkEndpointId(trunkUuid);
		const username = 'new-trunk-user';

		await repo.upsertTrunk(
			{
				endpointId: username,
				authMode: 'credentials',
				username,
				password: 'secret',
				identifyMatches: [],
				enabled: true,
				previousEndpointId,
			},
			trunkUuid,
		);

		expect(deleted.some((entry) => entry.criteria === previousEndpointId ||
			(typeof entry.criteria === 'object' &&
				entry.criteria !== null &&
				('id' in entry.criteria
					? (entry.criteria as { id: string }).id === previousEndpointId
					: (entry.criteria as { endpoint?: string }).endpoint === previousEndpointId)),
		)).toBe(true);
	});
});
