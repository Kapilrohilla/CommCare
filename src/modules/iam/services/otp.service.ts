import { Injectable, Logger } from '@nestjs/common';
import { env } from 'src/config/env.config';
import { Environment } from 'src/constants/environmentConstants';
import { RedisService } from 'src/infra/redis/services/redis.service';
import { HashService } from 'src/shared/utils/services/hash.service';
import { IdentifierType } from '../constants/identity.constant';
import {
	OTP_CACHE_NAME,
	OTP_LENGTH,
	OTP_RATE_LIMIT_CACHE_NAME,
	OTP_RATE_LIMIT_MAX,
	OTP_RATE_LIMIT_WINDOW_SECONDS,
	OTP_TTL_SECONDS,
} from '../constants/otp.constant';

@Injectable()
export class OtpService {
	private readonly logger = new Logger(OtpService.name);

	constructor(private readonly redisService: RedisService) {}

	normalizeIdentifier(identifierType: IdentifierType, identifier: string): string {
		const trimmed = identifier.trim();
		if (identifierType === IdentifierType.EMAIL) {
			return trimmed.toLowerCase();
		}
		return trimmed;
	}

	private otpKey(identifierType: IdentifierType, identifier: string): string {
		return `${identifierType}:${identifier}`;
	}

	async generateAndStoreOtp(identifierType: IdentifierType, identifier: string): Promise<string> {
		const normalized = this.normalizeIdentifier(identifierType, identifier);
		const rateKey = this.otpKey(identifierType, normalized);

		const attempts = await this.redisService.incrementKey(OTP_RATE_LIMIT_CACHE_NAME, rateKey);
		if (attempts === 1) {
			await this.redisService.expireKey(OTP_RATE_LIMIT_CACHE_NAME, rateKey, OTP_RATE_LIMIT_WINDOW_SECONDS);
		}
		if (attempts > OTP_RATE_LIMIT_MAX) {
			throw new Error('OTP rate limit exceeded');
		}

		const otp = this.generateOtp();
		const hashedOtp = await HashService.hash(otp);
		await this.redisService.setKey(OTP_CACHE_NAME, rateKey, hashedOtp, OTP_TTL_SECONDS);

		if (env.ENV === Environment.LOCAL) {
			this.logger.log(`OTP for ${identifierType}:${normalized} → ${otp}`);
		}

		return otp;
	}

	async verifyOtp(identifierType: IdentifierType, identifier: string, otp: string): Promise<boolean> {
		const normalized = this.normalizeIdentifier(identifierType, identifier);
		const key = this.otpKey(identifierType, normalized);
		const storedHash = await this.redisService.getKey<string>(OTP_CACHE_NAME, key);
		if (!storedHash) {
			return false;
		}

		const valid = await HashService.compare(otp, storedHash);
		if (valid) {
			await this.redisService.deleteKey(OTP_CACHE_NAME, key);
		}
		return valid;
	}

	private generateOtp(): string {
		const max = 10 ** OTP_LENGTH;
		const value = Math.floor(Math.random() * max);
		return value.toString().padStart(OTP_LENGTH, '0');
	}
}
