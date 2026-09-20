import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { HashService } from 'src/shared/utils/services/hash.service';
import { IdentifierType } from '../constants/identity.constant';
import { PasswordLoginDto, PasswordRegisterDto } from '../dto/auth.dto';
import { AuthService } from './auth.service';

describe('AuthService password auth', () => {
	const visitorId = 'visitor-1';

	function buildService(overrides?: {
		findByIdentifier?: jest.Mock;
		findOrCreateIdentity?: jest.Mock;
		setSecretHash?: jest.Mock;
		linkToUser?: jest.Mock;
		markVerified?: jest.Mock;
		isLocked?: jest.Mock;
		recordFailedAttempt?: jest.Mock;
		createUser?: jest.Mock;
		findById?: jest.Mock;
		createSession?: jest.Mock;
		findTenant?: jest.Mock;
	}) {
		const identityService = {
			findByIdentifier: overrides?.findByIdentifier ?? jest.fn(async () => null),
			findOrCreateIdentity:
				overrides?.findOrCreateIdentity ??
				jest.fn(async () => ({ id: 'identity-1', userId: null, secretHash: null })),
			setSecretHash: overrides?.setSecretHash ?? jest.fn(async (identity) => identity),
			linkToUser: overrides?.linkToUser ?? jest.fn(async (identity) => identity),
			markVerified: overrides?.markVerified ?? jest.fn(async (identity) => identity),
			isLocked: overrides?.isLocked ?? jest.fn(() => false),
			recordFailedAttempt: overrides?.recordFailedAttempt ?? jest.fn(async (identity) => identity),
		};
		const userService = {
			createUser:
				overrides?.createUser ??
				jest.fn(async (name: string) => ({ id: 'user-1', name, tenantId: null })),
			findById:
				overrides?.findById ??
				jest.fn(async () => ({ id: 'user-1', name: 'Jordan', tenantId: null })),
		};
		const sessionService = {
			createSession:
				overrides?.createSession ??
				jest.fn(async () => ({
					session: { id: 'session-1' },
					tokens: {
						accessToken: 'access',
						refreshToken: 'refresh',
						sessionId: 'session-1',
						expiresAt: new Date().toISOString(),
					},
				})),
		};
		const authEventService = {
			logLogin: jest.fn(async () => undefined),
			logSessionCreated: jest.fn(async () => undefined),
		};
		const tenancyService = {
			findByIdOrNull: overrides?.findTenant ?? jest.fn(async () => null),
		};

		const service = new AuthService(
			{} as never,
			identityService as never,
			userService as never,
			sessionService as never,
			{} as never,
			authEventService as never,
			tenancyService as never,
		);

		return { service, identityService, userService, sessionService, authEventService };
	}

	it('rejects invalid password register payloads via Zod', () => {
		const result = PasswordRegisterDto.safeParse({
			identifier: 'not-an-email',
			identifierType: IdentifierType.EMAIL,
			password: 'short',
			name: '',
		});
		expect(result.success).toBe(false);
	});

	it('rejects empty password login payloads via Zod', () => {
		const result = PasswordLoginDto.safeParse({
			identifier: 'jordan@atlasfield.co',
			identifierType: IdentifierType.EMAIL,
			password: '',
		});
		expect(result.success).toBe(false);
	});

	it('registers a password account and issues session tokens', async () => {
		const { service, identityService, sessionService } = buildService();
		const result = await service.registerWithPassword(
			{
				identifier: 'jordan@atlasfield.co',
				identifierType: IdentifierType.EMAIL,
				password: 'securepass',
				name: 'Jordan',
			},
			visitorId,
		);

		expect(identityService.setSecretHash).toHaveBeenCalled();
		expect(sessionService.createSession).toHaveBeenCalledWith(
			expect.objectContaining({ visitorId, userId: 'user-1', identityId: 'identity-1' }),
		);
		expect(result.accessToken).toBe('access');
		expect(result.refreshToken).toBe('refresh');
		expect(result.user.name).toBe('Jordan');
	});

	it('rejects duplicate password registration', async () => {
		const { service } = buildService({
			findByIdentifier: jest.fn(async () => ({
				id: 'identity-1',
				userId: 'user-existing',
				secretHash: 'hash',
			})),
		});

		await expect(
			service.registerWithPassword(
				{
					identifier: 'jordan@atlasfield.co',
					identifierType: IdentifierType.EMAIL,
					password: 'securepass',
					name: 'Jordan',
				},
				visitorId,
			),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('logs in with a valid password', async () => {
		const secretHash = await HashService.hash('securepass');
		const { service, sessionService } = buildService({
			findByIdentifier: jest.fn(async () => ({
				id: 'identity-1',
				userId: 'user-1',
				secretHash,
			})),
		});

		const result = await service.loginWithPassword(
			{
				identifier: 'jordan@atlasfield.co',
				identifierType: IdentifierType.EMAIL,
				password: 'securepass',
			},
			visitorId,
		);

		expect(sessionService.createSession).toHaveBeenCalled();
		expect(result.accessToken).toBe('access');
	});

	it('rejects login when password is wrong', async () => {
		const secretHash = await HashService.hash('securepass');
		const { service, sessionService, identityService } = buildService({
			findByIdentifier: jest.fn(async () => ({
				id: 'identity-1',
				userId: 'user-1',
				secretHash,
			})),
		});

		await expect(
			service.loginWithPassword(
				{
					identifier: 'jordan@atlasfield.co',
					identifierType: IdentifierType.EMAIL,
					password: 'wrong-password',
				},
				visitorId,
			),
		).rejects.toBeInstanceOf(UnauthorizedException);
		expect(identityService.recordFailedAttempt).toHaveBeenCalled();
		expect(sessionService.createSession).not.toHaveBeenCalled();
	});

	it('rejects login when identity has no password hash', async () => {
		const { service, sessionService } = buildService({
			findByIdentifier: jest.fn(async () => ({
				id: 'identity-1',
				userId: 'user-1',
				secretHash: null,
			})),
		});

		await expect(
			service.loginWithPassword(
				{
					identifier: 'jordan@atlasfield.co',
					identifierType: IdentifierType.EMAIL,
					password: 'securepass',
				},
				visitorId,
			),
		).rejects.toBeInstanceOf(UnauthorizedException);
		expect(sessionService.createSession).not.toHaveBeenCalled();
	});
});
