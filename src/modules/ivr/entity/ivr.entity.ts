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

	@Column({ type: 'varchar', length: 500 })
	description!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'announcement_recording_id', type: 'uuid', nullable: true })
	announcementRecordingId: string | null = null;

	@ManyToOne(() => SystemRecording, { nullable: true })
	@JoinColumn({ name: 'announcement_recording_id' })
	announcementRecording?: SystemRecording | null;

	@OneToMany(() => IVROptionEntity, (option) => option.ivr)
	options?: IVROptionEntity[];

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
