import { Injectable } from '@nestjs/common';
import { Extension } from '../entity/extension.entity';
import { PjsipRealtimeRepository } from '../repositories/pjsip-realtime.repository';

describe('PjsipRealtimeRepository', () => {
	it('maps extension number to stable ps_* ids', () => {
		const repo = new PjsipRealtimeRepository(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
		);
		expect(repo.endpointIds('101')).toEqual({
			endpointId: '101',
			authId: '101-auth',
			aorId: '101-aor',
		});
	});
});
