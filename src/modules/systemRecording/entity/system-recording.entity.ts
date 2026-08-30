import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import {
	SystemRecordingSourceType,
	SystemRecordingStatus,
} from '../constants/system-recording.constant';

@Entity('system_recordings')
export class SystemRecording {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'varchar', length: 255 })
	name!: string;

	@Column({ type: 'text', nullable: true })
	description: string | null = null;

	@Column({ type: 'uuid' })
	tenantId!: string;

	@Column({
		type: 'enum',
		enum: SystemRecordingSourceType,
		nullable: true,
	})
	sourceType: SystemRecordingSourceType | null = null;

	@Column({ type: 'varchar', length: 512, nullable: true })
	storageKey: string | null = null;

	@Column({ type: 'varchar', length: 128, nullable: true })
	mimeType: string | null = null;

	@Column({ type: 'varchar', length: 32, nullable: true })
	format: string | null = null;

	@Column({ type: 'varchar', length: 32, nullable: true })
	codec: string | null = null;

	@Column({ type: 'integer', nullable: true })
	sampleRate: number | null = null;

	@Column({ type: 'integer', nullable: true })
	channels: number | null = null;

	@Column({ type: 'integer', nullable: true })
	duration: number | null = null;

	@Column({ type: 'bigint', nullable: true })
	fileSize: number | null = null;

	@Column({ type: 'varchar', length: 16, nullable: true })
	ttsLanguage: string | null = null;

	@Column({ type: 'varchar', length: 64, nullable: true })
	ttsVoice: string | null = null;

	@Column({ type: 'text', nullable: true })
	ttsText: string | null = null;

	@Column({
		type: 'enum',
		enum: SystemRecordingStatus,
		default: SystemRecordingStatus.PENDING,
	})
	status: SystemRecordingStatus = SystemRecordingStatus.PENDING;

	@Column({ type: 'text', nullable: true })
	errorMessage: string | null = null;

	@CreateDateColumn({ type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ type: 'timestamptz' })
	updatedAt!: Date;
}
