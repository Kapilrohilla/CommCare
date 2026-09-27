import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { QueueCallStatus } from '../constants/queue.constant';

@Entity('queue_calls')
@Index('idx_queue_call_queue_id', ['queueId'])
@Index('idx_queue_call_caller_channel_id', ['callerChannelId'], { unique: true })
export class QueueCallEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'queue_id', type: 'uuid' })
	queueId!: string;

	@Column({ name: 'caller_channel_id', type: 'varchar', length: 100 })
	callerChannelId!: string;

	@Column({ name: 'caller_number', type: 'varchar', length: 255, nullable: true })
	callerNumber: string | null = null;

	@Column({ type: 'enum', enum: QueueCallStatus })
	status!: QueueCallStatus;

	@Column({ name: 'ringing_channel_ids', type: 'jsonb', default: () => "'[]'" })
	ringingChannelIds: string[] = [];

	@Column({ name: 'attempt_order', type: 'jsonb', default: () => "'[]'" })
	attemptOrder: string[] = [];

	@Column({ name: 'bridge_id', type: 'varchar', length: 100, nullable: true })
	bridgeId: string | null = null;

	@Column({ name: 'answered_member_id', type: 'uuid', nullable: true })
	answeredMemberId: string | null = null;

	@Column({ name: 'answered_agent_id', type: 'uuid', nullable: true })
	answeredAgentId: string | null = null;

	@Column({ name: 'entered_at', type: 'timestamptz' })
	enteredAt!: Date;

	@Column({ name: 'bridged_at', type: 'timestamptz', nullable: true })
	bridgedAt: Date | null = null;

	@Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
	endedAt: Date | null = null;

	@Column({ name: 'wait_seconds', type: 'int', nullable: true })
	waitSeconds: number | null = null;

	@Column({ name: 'talk_seconds', type: 'int', nullable: true })
	talkSeconds: number | null = null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
