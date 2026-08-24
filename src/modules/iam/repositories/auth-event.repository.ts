import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from 'src/infra/database/connectors/baseRepository';
import { DB_CONNECTION_WRITER } from 'src/infra/database/postgresql/postgresqlConfig';
import { AuthEventSubject } from '../constants/auth-event.constant';
import { AuthEventEntity } from '../entity/auth-event.entity';

export interface LogAuthEventInput {
	subject: AuthEventSubject;
	success: boolean;
	userId?: string | null;
	identityId?: string | null;
	tenantId?: string | null;
	failureReason?: string | null;
}

@Injectable()
export class AuthEventRepository {
	constructor(
		@InjectRepository(AuthEventEntity, DB_CONNECTION_WRITER)
		private readonly writerRepository: BaseRepository<AuthEventEntity>,
	) {}

	log(input: LogAuthEventInput): Promise<AuthEventEntity> {
		const event = this.writerRepository.create({
			subject: input.subject,
			success: input.success,
			userId: input.userId ?? null,
			identityId: input.identityId ?? null,
			tenantId: input.tenantId ?? null,
			failureReason: input.failureReason ?? null,
		});
		return this.writerRepository.save(event);
	}
}
