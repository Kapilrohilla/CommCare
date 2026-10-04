import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from 'src/shared/guards/jwt-auth.guard';
import { WebhookRegistryController } from './webhook-registery.controller';
import { WebhookRegistryService } from '../services/webhook-registry.service';
import { CreateWebhookRegistryDto } from '../dto/webhook-registry.dto';

describe('WebhookRegistryController request validation (HTTP)', () => {
	let app: INestApplication;
	const service = {
		createWebhookRegistry: jest.fn(async () => ({ id: 'w1' })),
		updateWebhookRegistry: jest.fn(async () => ({ id: 'w1' })),
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [WebhookRegistryController],
			providers: [{ provide: WebhookRegistryService, useValue: service }],
		})
			.overrideGuard(AccessTokenGuard)
			.useValue({
				canActivate: (ctx: ExecutionContext) => {
					ctx.switchToHttp().getRequest().auth = { tenantId: 'tenant-1', userId: 'user-1' };
					return true;
				},
			})
			.compile();
		app = moduleRef.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => jest.clearAllMocks());

	const base = { name: 'hook', endpoint: 'https://example.com/hook', method: 'post' };

	it('POST rejects an unknown triggerEvent with 400 and does not call the service', async () => {
		const res = await request(app.getHttpServer())
			.post('/webhook-registry')
			.send({ ...base, triggerEvent: 'SystemRecording.Deleted' });
		expect(res.status).toBe(400);
		expect(service.createWebhookRegistry).not.toHaveBeenCalled();
	});

	it('POST accepts SystemRecording.Processed and reaches the service', async () => {
		const res = await request(app.getHttpServer())
			.post('/webhook-registry')
			.send({ ...base, triggerEvent: 'SystemRecording.Processed' });
		expect(res.status).toBe(201);
		expect(service.createWebhookRegistry).toHaveBeenCalledTimes(1);
	});

	it('PUT rejects an unknown triggerEvent with 400 and does not call the service', async () => {
		const res = await request(app.getHttpServer())
			.put('/webhook-registry/w1')
			.send({ triggerEvent: 'SystemRecording.Deleted' });
		expect(res.status).toBe(400);
		expect(service.updateWebhookRegistry).not.toHaveBeenCalled();
	});

	it('PUT accepts a valid triggerEvent and reaches the service with the id param intact', async () => {
		const res = await request(app.getHttpServer())
			.put('/webhook-registry/w1')
			.send({ triggerEvent: 'SystemRecording.Failed' });
		expect(res.status).toBe(200);
		expect(service.updateWebhookRegistry).toHaveBeenCalledWith(
			'w1',
			{ triggerEvent: 'SystemRecording.Failed' },
			expect.anything(),
		);
	});

	describe('payload shape submitted by the frontend CreateWebhookDialog', () => {
		const dialogPayload = (description: string | undefined) => ({
			name: 'hook',
			description,
			endpoint: 'https://example.com/hook',
			method: 'post',
			triggerEvent: 'Click2Call.CalleeConnected',
		});

		it('passes the DTO with description absent (JSON drops undefined)', () => {
			const body = JSON.parse(JSON.stringify(dialogPayload(undefined)));
			expect(CreateWebhookRegistryDto.safeParse(body).success).toBe(true);
		});

		it('passes the DTO with description present', () => {
			expect(CreateWebhookRegistryDto.safeParse(dialogPayload('some text')).success).toBe(true);
		});

		it('is accepted over HTTP', async () => {
			const body = JSON.parse(JSON.stringify(dialogPayload(undefined)));
			const res = await request(app.getHttpServer()).post('/webhook-registry').send(body);
			expect(res.status).toBe(201);
		});
	});
});
