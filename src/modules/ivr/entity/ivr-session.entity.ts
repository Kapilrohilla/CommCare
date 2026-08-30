import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { IVRSessionState } from '../constants/ivr-session.constant';

@Entity('ivr_sessions')
export class IVRSessionEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'call_id', type: 'uuid' })
	callId!: string;

	@Column({ name: 'ivr_id', type: 'uuid' })
	ivrId!: string;

	@Column({ type: 'enum', enum: IVRSessionState })
	state!: IVRSessionState;

	@Column({ name: 'invalid_attempts', type: 'int', default: 0 })
	invalidAttempts = 0;

	@Column({ name: 'timeout_attempts', type: 'int', default: 0 })
	timeoutAttempts = 0;

	@Column({ name: 'last_digit', type: 'varchar', length: 8, nullable: true })
	lastDigit: string | null = null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
