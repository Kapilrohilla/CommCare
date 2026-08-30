import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { IVROptionDestinationType } from '../constants/ivr-options.constant';
import { IVREntity } from './ivr.entity';

@Entity('ivr_options')
export class IVROptionEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'ivr_id', type: 'uuid' })
	ivrId!: string;

	@ManyToOne(() => IVREntity, (ivr) => ivr.options, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'ivr_id' })
	ivr?: IVREntity;

	@Column({ type: 'varchar', length: 8 })
	digit!: string;

	@Column({
		name: 'destination_type',
		type: 'enum',
		enum: IVROptionDestinationType,
	})
	destinationType!: IVROptionDestinationType;

	@Column({ name: 'destination_id', type: 'uuid', nullable: true })
	destinationId: string | null = null;

	@Column({ name: 'destination_value', type: 'varchar', length: 64, nullable: true })
	destinationValue: string | null = null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
