import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { QueueCallEventType } from '../constants/queue.constant';

@Entity('queue_call_events')
@Index('idx_queue_call_event_queue_call_id', ['queueCallId'])
export class QueueCallEventEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'queue_id', type: 'uuid' })
	queueId!: string;

	@Column({ name: 'queue_call_id', type: 'uuid' })
	queueCallId!: string;

	@Column({ name: 'event_type', type: 'enum', enum: QueueCallEventType })
	eventType!: QueueCallEventType;

	@Column({ name: 'member_id', type: 'uuid', nullable: true })
	memberId: string | null = null;

	@Column({ name: 'agent_id', type: 'uuid', nullable: true })
	agentId: string | null = null;

	@Column({ name: 'channel_id', type: 'varchar', length: 100, nullable: true })
	channelId: string | null = null;

	@Column({ type: 'jsonb', default: () => "'{}'" })
	payload: Record<string, unknown> = {};

	@Column({ name: 'event_time', type: 'timestamptz' })
	eventTime!: Date;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;
}
