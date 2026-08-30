import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { ExtensionService } from 'src/modules/pbx/services/extension.service';
import { SystemRecordingService } from 'src/modules/systemRecording/services/system-recording.service';
import { SystemRecordingStatus } from 'src/modules/systemRecording/constants/system-recording.constant';
import { AuthContext } from 'src/shared/types/auth.types';
import { IVROptionDestinationType } from '../constants/ivr-options.constant';
import { IVRSessionState } from '../constants/ivr-session.constant';
import { CreateIvrOptionDto, UpdateIvrOptionDto } from '../dto/ivr-options.dto';
import { CreateIvrSessionDto, UpdateIvrSessionDto } from '../dto/ivr-session.dto';
import { CreateIvrDto, UpdateIvrDto } from '../dto/ivr.dto';
import { IVROptionEntity } from '../entity/ivr-options.entity';
import { IVRSessionEntity } from '../entity/ivr-session.entity';
import { IVREntity } from '../entity/ivr.entity';
import { IVRRepository } from '../repository/ivr.repository';
import { IVROptionsService } from './ivr-options.service';
import { IVRSessionService } from './ivr-session.service';

@Injectable()
export class IVRService {
	constructor(
		private readonly ivrRepository: IVRRepository,
		private readonly ivrOptionsService: IVROptionsService,
		private readonly ivrSessionService: IVRSessionService,
		private readonly systemRecordingService: SystemRecordingService,
		private readonly extensionService: ExtensionService,
	) {}

	async createIvr(auth: AuthContext, dto: CreateIvrDto): Promise<IVREntity> {
		const tenantId = this.requireTenant(auth);

		if (dto.announcementRecordingId) {
			await this.validateAnnouncementRecording(auth, dto.announcementRecordingId);
		}

		const ivr = new IVREntity();
		ivr.description = dto.description;
		ivr.tenantId = tenantId;
		ivr.announcementRecordingId = dto.announcementRecordingId ?? null;

		return this.ivrRepository.create(ivr);
	}

	async getIvrsByTenant(auth: AuthContext): Promise<IVREntity[]> {
		return this.ivrRepository.getByTenantId(this.requireTenant(auth));
	}

	async getIvrById(auth: AuthContext, id: string): Promise<IVREntity> {
		return this.getIvrForTenant(auth, id);
	}

	async updateIvr(
		auth: AuthContext,
		id: string,
		dto: UpdateIvrDto,
	): Promise<IVREntity> {
		const ivr = await this.getIvrForTenant(auth, id);

		if (dto.description !== undefined) {
			ivr.description = dto.description;
		}

		if (dto.announcementRecordingId !== undefined) {
			if (dto.announcementRecordingId) {
				await this.validateAnnouncementRecording(auth, dto.announcementRecordingId);
			}
			ivr.announcementRecordingId = dto.announcementRecordingId;
		}

		return this.ivrRepository.save(ivr);
	}

	async deleteIvr(auth: AuthContext, id: string): Promise<void> {
		await this.getIvrForTenant(auth, id);
		await this.ivrRepository.delete(id);
	}

	async createOption(
		auth: AuthContext,
		ivrId: string,
		dto: CreateIvrOptionDto,
	): Promise<IVROptionEntity> {
		await this.getIvrForTenant(auth, ivrId);

		const existing = await this.ivrOptionsService.getByIvrIdAndDigit(
			ivrId,
			dto.digit,
		);
		if (existing) {
			throw new BadRequestException(
				`Digit ${dto.digit} is already configured for this IVR`,
			);
		}

		await this.validateDestination(auth, ivrId, dto);

		const option = new IVROptionEntity();
		option.ivrId = ivrId;
		option.digit = dto.digit;
		option.destinationType = dto.destinationType;
		option.destinationId = dto.destinationId ?? null;
		option.destinationValue = dto.destinationValue ?? null;

		return this.ivrOptionsService.create(option);
	}

	async getOptions(auth: AuthContext, ivrId: string): Promise<IVROptionEntity[]> {
		await this.getIvrForTenant(auth, ivrId);
		return this.ivrOptionsService.getByIvrId(ivrId);
	}

	async getOptionById(
		auth: AuthContext,
		ivrId: string,
		optionId: string,
	): Promise<IVROptionEntity> {
		await this.getIvrForTenant(auth, ivrId);
		return this.getOptionForIvr(ivrId, optionId);
	}

	async updateOption(
		auth: AuthContext,
		ivrId: string,
		optionId: string,
		dto: UpdateIvrOptionDto,
	): Promise<IVROptionEntity> {
		await this.getIvrForTenant(auth, ivrId);
		const option = await this.getOptionForIvr(ivrId, optionId);

		if (dto.digit !== undefined && dto.digit !== option.digit) {
			const existing = await this.ivrOptionsService.getByIvrIdAndDigit(
				ivrId,
				dto.digit,
			);
			if (existing && existing.id !== option.id) {
				throw new BadRequestException(
					`Digit ${dto.digit} is already configured for this IVR`,
				);
			}
			option.digit = dto.digit;
		}

		const nextDestination = {
			destinationType: dto.destinationType ?? option.destinationType,
			destinationId:
				dto.destinationId !== undefined
					? dto.destinationId
					: option.destinationId,
			destinationValue:
				dto.destinationValue !== undefined
					? dto.destinationValue
					: option.destinationValue,
		};

		if (
			dto.destinationType !== undefined ||
			dto.destinationId !== undefined ||
			dto.destinationValue !== undefined
		) {
			await this.validateDestination(auth, ivrId, nextDestination);
			option.destinationType = nextDestination.destinationType;
			option.destinationId = nextDestination.destinationId ?? null;
			option.destinationValue = nextDestination.destinationValue ?? null;
		}

		return this.ivrOptionsService.save(option);
	}

	async deleteOption(
		auth: AuthContext,
		ivrId: string,
		optionId: string,
	): Promise<void> {
		await this.getIvrForTenant(auth, ivrId);
		const option = await this.getOptionForIvr(ivrId, optionId);
		await this.ivrOptionsService.delete(option.id);
	}

	async createSession(
		auth: AuthContext,
		dto: CreateIvrSessionDto,
	): Promise<IVRSessionEntity> {
		const tenantId = this.requireTenant(auth);
		await this.getIvrForTenant(auth, dto.ivrId);

		const session = new IVRSessionEntity();
		session.tenantId = tenantId;
		session.callId = dto.callId;
		session.ivrId = dto.ivrId;
		session.state = IVRSessionState.STARTED;
		session.invalidAttempts = 0;
		session.timeoutAttempts = 0;
		session.lastDigit = null;

		return this.ivrSessionService.create(session);
	}

	async getSessionById(auth: AuthContext, id: string): Promise<IVRSessionEntity> {
		const tenantId = this.requireTenant(auth);
		const session = await this.ivrSessionService.getByIdAndTenantId(id, tenantId);

		if (!session) {
			throw new NotFoundException('IVR session not found');
		}

		return session;
	}

	async getSessionByCallId(
		auth: AuthContext,
		callId: string,
	): Promise<IVRSessionEntity> {
		const tenantId = this.requireTenant(auth);
		const session = await this.ivrSessionService.getByCallIdAndTenantId(
			callId,
			tenantId,
		);

		if (!session) {
			throw new NotFoundException('IVR session not found for call');
		}

		return session;
	}

	async getSessionsByIvrId(
		auth: AuthContext,
		ivrId: string,
	): Promise<IVRSessionEntity[]> {
		await this.getIvrForTenant(auth, ivrId);
		return this.ivrSessionService.getByIvrId(ivrId);
	}

	async updateSession(
		auth: AuthContext,
		id: string,
		dto: UpdateIvrSessionDto,
	): Promise<IVRSessionEntity> {
		const session = await this.getSessionById(auth, id);

		if (dto.state !== undefined) {
			session.state = dto.state;
		}
		if (dto.lastDigit !== undefined) {
			session.lastDigit = dto.lastDigit;
		}
		if (dto.invalidAttempts !== undefined) {
			session.invalidAttempts = dto.invalidAttempts;
		}
		if (dto.timeoutAttempts !== undefined) {
			session.timeoutAttempts = dto.timeoutAttempts;
		}

		return this.ivrSessionService.save(session);
	}

	async deleteSession(auth: AuthContext, id: string): Promise<void> {
		await this.getSessionById(auth, id);
		await this.ivrSessionService.delete(id);
	}

	private async getIvrForTenant(
		auth: AuthContext,
		id: string,
	): Promise<IVREntity> {
		const tenantId = this.requireTenant(auth);
		const ivr = await this.ivrRepository.getByIdAndTenantId(id, tenantId);

		if (!ivr) {
			throw new NotFoundException('IVR not found');
		}

		return ivr;
	}

	private async getOptionForIvr(
		ivrId: string,
		optionId: string,
	): Promise<IVROptionEntity> {
		const option = await this.ivrOptionsService.getByIdAndIvrId(optionId, ivrId);
		if (!option) {
			throw new NotFoundException('IVR option not found');
		}

		return option;
	}

	private async validateAnnouncementRecording(
		auth: AuthContext,
		recordingId: string,
	): Promise<void> {
		const recording = await this.systemRecordingService.getSystemRecordingById(
			auth,
			recordingId,
		);

		if (recording.status !== SystemRecordingStatus.ACTIVE) {
			throw new BadRequestException(
				'Announcement recording must be active before it can be used',
			);
		}
	}

	private async validateDestination(
		auth: AuthContext,
		ivrId: string,
		dto: {
			destinationType: IVROptionDestinationType;
			destinationId?: string | null;
			destinationValue?: string | null;
		},
	): Promise<void> {
		switch (dto.destinationType) {
			case IVROptionDestinationType.HANGUP:
			case IVROptionDestinationType.PHONE_NUMBER:
			case IVROptionDestinationType.QUEUE:
				return;
			case IVROptionDestinationType.IVR: {
				if (dto.destinationId === ivrId) {
					throw new BadRequestException('IVR option cannot route to the same IVR');
				}
				await this.getIvrForTenant(auth, dto.destinationId!);
				return;
			}
			case IVROptionDestinationType.EXTENSION: {
				const tenantId = this.requireTenant(auth);
				const extensions = await this.extensionService.getExtensionsByTenantId(
					tenantId,
				);
				if (!extensions.some((extension) => extension.id === dto.destinationId)) {
					throw new NotFoundException('Destination extension not found');
				}
				return;
			}
		}
	}

	private requireTenant(auth: AuthContext): string {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}

		return auth.tenantId;
	}
}
