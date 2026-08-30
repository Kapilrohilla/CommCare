import { Injectable } from '@nestjs/common';
import { IVRSessionEntity } from '../entity/ivr-session.entity';
import { IVRSessionRepository } from '../repository/ivr-session.repository';

@Injectable()
export class IVRSessionService {
	constructor(private readonly ivrSessionRepository: IVRSessionRepository) {}

	create(session: IVRSessionEntity): Promise<IVRSessionEntity> {
		return this.ivrSessionRepository.create(session);
	}

	save(session: IVRSessionEntity): Promise<IVRSessionEntity> {
		return this.ivrSessionRepository.save(session);
	}

	delete(id: string): Promise<void> {
		return this.ivrSessionRepository.delete(id);
	}

	getById(id: string): Promise<IVRSessionEntity | null> {
		return this.ivrSessionRepository.getById(id);
	}

	getByIdAndTenantId(
		id: string,
		tenantId: string,
	): Promise<IVRSessionEntity | null> {
		return this.ivrSessionRepository.getByIdAndTenantId(id, tenantId);
	}

	getByCallId(callId: string): Promise<IVRSessionEntity | null> {
		return this.ivrSessionRepository.getByCallId(callId);
	}

	getByCallIdAndTenantId(
		callId: string,
		tenantId: string,
	): Promise<IVRSessionEntity | null> {
		return this.ivrSessionRepository.getByCallIdAndTenantId(callId, tenantId);
	}

	getByIvrId(ivrId: string): Promise<IVRSessionEntity[]> {
		return this.ivrSessionRepository.getByIvrId(ivrId);
	}
}
