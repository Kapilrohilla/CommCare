import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { SystemRecordingRepository } from '../repositories/system-recording.repository';
import { AuthContext } from 'src/shared/types/auth.types';
import {
	ConfirmUploadSystemRecordingDto,
	CreateSystemRecordingDto,
	UpdateSystemRecordingDto,
	UploadSystemRecordingFileDto,
} from '../dto/system-recording.dto';
import { SystemRecording } from '../entity/system-recording.entity';
import { StorageService } from 'src/infra/storage/services/storage.service';
import { RecordingProcessorService } from './recording-processor.service';
import { TextToSpeechService } from './text-to-speech.service';
import {
	SystemRecordingSourceType,
	SystemRecordingStatus,
} from '../constants/system-recording.constant';
import { EventProducer } from 'src/infra/queue/services/event-producer.service';
import { Events } from 'src/constants/event.constant';
import {
	SystemRecordingTtsProcessPayload,
	SystemRecordingUploadProcessPayload,
} from '../types/system-recording.types';
import { ProcessedAudioResult } from '../types/system-recording.types';

@Injectable()
export class SystemRecordingService {
	private readonly logger = new Logger(SystemRecordingService.name);

	constructor(
		private readonly systemRecordingRepository: SystemRecordingRepository,
		private readonly storageService: StorageService,
		private readonly recordingProcessorService: RecordingProcessorService,
		private readonly textToSpeechService: TextToSpeechService,
		private readonly eventProducer: EventProducer,
	) {}

	async createSystemRecording(
		auth: AuthContext,
		dto: CreateSystemRecordingDto,
	): Promise<SystemRecording> {
		this.requireTenant(auth);

		const recording = new SystemRecording();
		recording.name = dto.name;
		recording.description = dto.description ?? null;
		recording.tenantId = auth.tenantId!;
		recording.status = SystemRecordingStatus.PENDING;

		return this.systemRecordingRepository.create(recording);
	}

	async getSystemRecordingsByTenant(auth: AuthContext): Promise<SystemRecording[]> {
		this.requireTenant(auth);
		return this.systemRecordingRepository.getByTenantId(auth.tenantId!);
	}

	async getSystemRecordingById(
		auth: AuthContext,
		id: string,
	): Promise<SystemRecording> {
		return this.getRecordingForTenant(auth, id);
	}

	async updateSystemRecordingById(
		auth: AuthContext,
		id: string,
		dto: UpdateSystemRecordingDto,
	): Promise<SystemRecording> {
		const recording = await this.getRecordingForTenant(auth, id);

		if (recording.status === SystemRecordingStatus.PROCESSING) {
			throw new BadRequestException(
				'Cannot update a system recording while it is processing',
			);
		}

		if (dto.name !== undefined) {
			recording.name = dto.name;
		}
		if (dto.description !== undefined) {
			recording.description = dto.description ?? null;
		}
		if (dto.sourceType !== undefined) {
			recording.sourceType = dto.sourceType;
		}
		if (dto.ttsLanguage !== undefined) {
			recording.ttsLanguage = dto.ttsLanguage ?? null;
		}
		if (dto.ttsVoice !== undefined) {
			recording.ttsVoice = dto.ttsVoice ?? null;
		}
		if (dto.ttsText !== undefined) {
			recording.ttsText = dto.ttsText ?? null;
		}

		recording.errorMessage = null;

		return this.systemRecordingRepository.save(recording);
	}

	async deleteSystemRecordingById(
		auth: AuthContext,
		id: string,
	): Promise<void> {
		const recording = await this.getRecordingForTenant(auth, id);

		if (recording.storageKey) {
			try {
				await this.storageService.delete({ path: recording.storageKey });
			} catch (error) {
				this.logger.warn(
					`Failed to delete storage object ${recording.storageKey}: ${error instanceof Error ? error.message : error}`,
				);
			}
		}

		await this.systemRecordingRepository.delete(recording.id);
	}

	async createUploadUrl(
		auth: AuthContext,
		id: string,
		dto: UploadSystemRecordingFileDto,
	) {
		const recording = await this.getRecordingForTenant(auth, id);

		if (recording.sourceType !== SystemRecordingSourceType.UPLOAD) {
			throw new BadRequestException(
				'Upload URL is only available when sourceType is upload',
			);
		}

		const path = this.buildRawUploadPath(
			recording.tenantId,
			recording.id,
			dto.fileName,
		);

		return this.storageService.createUploadUrl({ path });
	}

	async confirmUpload(
		auth: AuthContext,
		id: string,
		dto: ConfirmUploadSystemRecordingDto,
	): Promise<SystemRecording> {
		const recording = await this.getRecordingForTenant(auth, id);

		if (recording.sourceType !== SystemRecordingSourceType.UPLOAD) {
			throw new BadRequestException(
				'Upload confirm is only available when sourceType is upload',
			);
		}

		const sourceStorageKey = this.buildRawUploadPath(
			recording.tenantId,
			recording.id,
			dto.fileName,
		);

		const { exists } = await this.storageService.exists({
			path: sourceStorageKey,
		});

		if (!exists) {
			throw new NotFoundException(
				'Uploaded file not found in storage. Upload the file before confirming.',
			);
		}

		recording.storageKey = sourceStorageKey;
		recording.status = SystemRecordingStatus.PROCESSING;
		recording.errorMessage = null;
		await this.systemRecordingRepository.save(recording);

		await this.enqueueUploadProcessing(recording, sourceStorageKey);

		return recording;
	}

	async processSystemRecording(
		auth: AuthContext,
		id: string,
	): Promise<SystemRecording> {
		const recording = await this.getRecordingForTenant(auth, id);

		if (!recording.sourceType) {
			throw new BadRequestException('sourceType must be set before processing');
		}

		if (recording.status === SystemRecordingStatus.PROCESSING) {
			throw new BadRequestException('System recording is already processing');
		}

		if (recording.sourceType === SystemRecordingSourceType.TTS) {
			if (!recording.ttsText?.trim()) {
				throw new BadRequestException('ttsText is required for TTS recordings');
			}

			recording.status = SystemRecordingStatus.PROCESSING;
			recording.errorMessage = null;
			await this.systemRecordingRepository.save(recording);
			await this.enqueueTtsProcessing(recording);
			return recording;
		}

		if (recording.sourceType === SystemRecordingSourceType.UPLOAD) {
			if (!recording.storageKey) {
				throw new BadRequestException(
					'Upload and confirm a file before processing upload recordings',
				);
			}

			recording.status = SystemRecordingStatus.PROCESSING;
			recording.errorMessage = null;
			await this.systemRecordingRepository.save(recording);
			await this.enqueueUploadProcessing(recording, recording.storageKey);
			return recording;
		}

		throw new BadRequestException(`Unsupported sourceType: ${recording.sourceType}`);
	}

	async handleEventSystemRecordingProcessUpload(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const data = payload as SystemRecordingUploadProcessPayload;
		if (!data?.systemRecordingId || !data?.sourceStorageKey) {
			this.logger.warn(`Skipping ${eventName} (retry ${retryCount}): invalid payload`);
			return;
		}

		const recording = await this.systemRecordingRepository.getById(
			data.systemRecordingId,
		);

		if (!recording) {
			this.logger.warn(`Recording ${data.systemRecordingId} not found`);
			return;
		}

		await this.runUploadProcessing(recording, data.sourceStorageKey);
	}

	async handleEventSystemRecordingGenerateTts(
		eventName: string,
		payload: unknown,
		retryCount: number,
	): Promise<void> {
		const data = payload as SystemRecordingTtsProcessPayload;
		if (!data?.systemRecordingId || !data?.ttsText) {
			this.logger.warn(`Skipping ${eventName} (retry ${retryCount}): invalid payload`);
			return;
		}

		const recording = await this.systemRecordingRepository.getById(
			data.systemRecordingId,
		);

		if (!recording) {
			this.logger.warn(`Recording ${data.systemRecordingId} not found`);
			return;
		}

		await this.runTtsProcessing(recording);
	}

	private async runUploadProcessing(
		recording: SystemRecording,
		sourceStorageKey: string,
	): Promise<void> {
		recording.status = SystemRecordingStatus.PROCESSING;
		recording.errorMessage = null;
		await this.systemRecordingRepository.save(recording);

		try {
			const result = await this.recordingProcessorService.processRecording(
				recording,
				sourceStorageKey,
			);
			await this.applyProcessedResult(recording, result);
		} catch (error) {
			await this.markFailed(
				recording,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private async runTtsProcessing(recording: SystemRecording): Promise<void> {
		recording.status = SystemRecordingStatus.PROCESSING;
		recording.errorMessage = null;
		await this.systemRecordingRepository.save(recording);

		try {
			const result = await this.textToSpeechService.generateSpeech(recording);
			await this.applyProcessedResult(recording, result);
		} catch (error) {
			await this.markFailed(
				recording,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private async applyProcessedResult(
		recording: SystemRecording,
		result: ProcessedAudioResult,
	): Promise<void> {
		recording.storageKey = result.storageKey;
		recording.mimeType = result.mimeType;
		recording.format = result.format;
		recording.codec = result.codec ?? null;
		recording.sampleRate = result.sampleRate ?? null;
		recording.channels = result.channels ?? null;
		recording.duration = result.duration ?? null;
		recording.fileSize = result.fileSize ?? null;
		recording.status = SystemRecordingStatus.ACTIVE;
		recording.errorMessage = null;

		await this.systemRecordingRepository.save(recording);

		this.logger.log(`System recording ${recording.id} is active at ${result.storageKey}`);
	}

	private async markFailed(
		recording: SystemRecording,
		message: string,
	): Promise<void> {
		recording.status = SystemRecordingStatus.FAILED;
		recording.errorMessage = message;
		await this.systemRecordingRepository.save(recording);
		this.logger.error(`System recording ${recording.id} failed: ${message}`);
	}

	private async enqueueUploadProcessing(
		recording: SystemRecording,
		sourceStorageKey: string,
	): Promise<void> {
		const payload: SystemRecordingUploadProcessPayload = {
			systemRecordingId: recording.id,
			tenantId: recording.tenantId,
			sourceStorageKey,
		};

		await this.eventProducer.publish(
			Events.systemRecordingProcessUpload,
			payload,
			{ partitionKey: recording.id },
		);
	}

	private async enqueueTtsProcessing(recording: SystemRecording): Promise<void> {
		const payload: SystemRecordingTtsProcessPayload = {
			systemRecordingId: recording.id,
			tenantId: recording.tenantId,
			ttsText: recording.ttsText!,
			ttsLanguage: recording.ttsLanguage,
			ttsVoice: recording.ttsVoice,
		};

		await this.eventProducer.publish(
			Events.systemRecordingGenerateTts,
			payload,
			{ partitionKey: recording.id },
		);
	}

	private buildRawUploadPath(
		tenantId: string,
		recordingId: string,
		fileName: string,
	): string {
		return `system_recordings/${tenantId}/${recordingId}/raw/${fileName}`;
	}

	buildProcessedStoragePath(tenantId: string, recordingId: string): string {
		return `system_recordings/${tenantId}/${recordingId}/processed/audio.wav`;
	}

	private async getRecordingForTenant(
		auth: AuthContext,
		id: string,
	): Promise<SystemRecording> {
		this.requireTenant(auth);

		const recording = await this.systemRecordingRepository.getByIdAndTenantId(
			id,
			auth.tenantId!,
		);

		if (!recording) {
			throw new NotFoundException('System recording not found');
		}

		return recording;
	}

	private requireTenant(auth: AuthContext): void {
		if (!auth.tenantId) {
			throw new ForbiddenException('Tenant setup required');
		}
	}

	/**
	 * Signed HTTP URL for Asterisk ARI playback (sound:http://...).
	 * Asterisk must be able to reach the URL from its network.
	 */
	async getTelephonyPlaybackUrl(
		tenantId: string,
		recordingId: string,
	): Promise<string | null> {
		const recording = await this.systemRecordingRepository.getByIdAndTenantId(
			recordingId,
			tenantId,
		);

		if (!recording?.storageKey || recording.status !== SystemRecordingStatus.ACTIVE) {
			return null;
		}

		const { url } = await this.storageService.createDownloadUrl({
			path: recording.storageKey,
			expiresIn: 3600,
		});

		return url;
	}
}
