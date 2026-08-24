import { Injectable } from '@nestjs/common';
import { IdentifierType } from '../constants/identity.constant';
import { IdentityEntity } from '../entity/identity.entity';
import { IdentityRepository } from '../repositories/identity.repository';
import { OtpService } from './otp.service';

@Injectable()
export class IdentityService {
	constructor(
		private readonly identityRepository: IdentityRepository,
		private readonly otpService: OtpService,
	) {}

	normalizeIdentifier(identifierType: IdentifierType, identifier: string): string {
		return this.otpService.normalizeIdentifier(identifierType, identifier);
	}

	findByIdentifier(identifierType: IdentifierType, identifier: string): Promise<IdentityEntity | null> {
		const normalized = this.normalizeIdentifier(identifierType, identifier);
		return this.identityRepository.findByIdentifier(identifierType, normalized);
	}

	findById(id: string): Promise<IdentityEntity | null> {
		return this.identityRepository.findById(id);
	}

	async findOrCreateIdentity(identifierType: IdentifierType, identifier: string): Promise<IdentityEntity> {
		const normalized = this.normalizeIdentifier(identifierType, identifier);
		const existing = await this.identityRepository.findByIdentifier(identifierType, normalized);
		if (existing) {
			return existing;
		}
		return this.identityRepository.create({
			identifierType,
			identifier: normalized,
			userId: null,
			secretHash: null,
			identityVerifiedAt: null,
			consecutiveFailedCount: 0,
		});
	}

	async markVerified(identity: IdentityEntity): Promise<IdentityEntity> {
		identity.identityVerifiedAt = new Date();
		identity.consecutiveFailedCount = 0;
		identity.lockedUntil = null;
		return this.identityRepository.save(identity);
	}

	async linkToUser(identity: IdentityEntity, userId: string): Promise<IdentityEntity> {
		identity.userId = userId;
		return this.identityRepository.save(identity);
	}

	isLocked(identity: IdentityEntity): boolean {
		return identity.lockedUntil !== null && identity.lockedUntil > new Date();
	}

	async recordFailedAttempt(identity: IdentityEntity): Promise<IdentityEntity> {
		identity.consecutiveFailedCount += 1;
		if (identity.consecutiveFailedCount >= 5) {
			identity.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
		}
		return this.identityRepository.save(identity);
	}
}
