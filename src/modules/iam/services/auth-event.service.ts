import { Injectable } from '@nestjs/common';
import { AuthEventSubject } from '../constants/auth-event.constant';
import { AuthEventRepository } from '../repositories/auth-event.repository';

@Injectable()
export class AuthEventService {
	constructor(private readonly authEventRepository: AuthEventRepository) {}

	logOtpSent(identityId: string, success: boolean, failureReason?: string) {
		return this.authEventRepository.log({
			subject: AuthEventSubject.OTP_SENT,
			success,
			identityId,
			failureReason,
		});
	}

	logOtpVerified(identityId: string, success: boolean, failureReason?: string) {
		return this.authEventRepository.log({
			subject: AuthEventSubject.OTP_VERIFIED,
			success,
			identityId,
			failureReason,
		});
	}

	logLogin(userId: string, identityId: string, tenantId: string | null, success: boolean, failureReason?: string) {
		return this.authEventRepository.log({
			subject: success ? AuthEventSubject.LOGIN_SUCCESS : AuthEventSubject.LOGIN_FAILED,
			success,
			userId,
			identityId,
			tenantId,
			failureReason,
		});
	}

	logSessionCreated(userId: string, identityId: string, tenantId: string | null) {
		return this.authEventRepository.log({
			subject: AuthEventSubject.SESSION_CREATED,
			success: true,
			userId,
			identityId,
			tenantId,
		});
	}

	logLogout(userId: string, identityId: string, tenantId: string | null) {
		return this.authEventRepository.log({
			subject: AuthEventSubject.LOGOUT,
			success: true,
			userId,
			identityId,
			tenantId,
		});
	}

	logSessionRevoked(userId: string, identityId: string, tenantId: string | null) {
		return this.authEventRepository.log({
			subject: AuthEventSubject.SESSION_REVOKED,
			success: true,
			userId,
			identityId,
			tenantId,
		});
	}
}
