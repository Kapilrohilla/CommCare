import { SystemRecording } from 'src/modules/systemRecording/entity/system-recording.entity';
import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { IVROptionDestinationType } from '../constants/ivr-options.constant';
import { IVRInvalidKeyAction } from '../constants/ivr.constant';
import { IVROptionEntity } from './ivr-options.entity';

@Entity({
	name: 'ivr',
	orderBy: {
		updatedAt: 'DESC',
	},
})
export class IVREntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'varchar', length: 120 })
	name!: string;

	@Column({ type: 'varchar', length: 500, nullable: true })
	description: string | null = null;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'announcement_recording_id', type: 'uuid', nullable: true })
	announcementRecordingId: string | null = null;

	@ManyToOne(() => SystemRecording, { nullable: true })
	@JoinColumn({ name: 'announcement_recording_id' })
	announcementRecording?: SystemRecording | null;

	@Column({ type: 'boolean', default: true })
	enabled = true;

	@Column({ name: 'input_timeout_seconds', type: 'int', default: 5 })
	inputTimeoutSeconds = 5;

	@Column({ name: 'max_invalid_retries', type: 'int', default: 3 })
	maxInvalidRetries = 3;

	@Column({
		name: 'invalid_key_action',
		type: 'enum',
		enum: IVRInvalidKeyAction,
		default: IVRInvalidKeyAction.ReplayAnnouncement,
	})
	invalidKeyAction: IVRInvalidKeyAction = IVRInvalidKeyAction.ReplayAnnouncement;

	@Column({
		name: 'final_timeout_destination_type',
		type: 'enum',
		enum: IVROptionDestinationType,
		default: IVROptionDestinationType.HANGUP,
	})
	finalTimeoutDestinationType: IVROptionDestinationType = IVROptionDestinationType.HANGUP;

	@Column({ name: 'final_timeout_destination_id', type: 'uuid', nullable: true })
	finalTimeoutDestinationId: string | null = null;

	@Column({
		name: 'final_timeout_destination_value',
		type: 'varchar',
		length: 64,
		nullable: true,
	})
	finalTimeoutDestinationValue: string | null = null;

	@OneToMany(() => IVROptionEntity, (option) => option.ivr)
	options?: IVROptionEntity[];

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
