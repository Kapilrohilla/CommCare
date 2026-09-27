import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import {
	DEFAULT_MAX_WAIT_TIME_SECONDS,
	DEFAULT_RING_TIMEOUT_SECONDS,
	QueueStrategy,
} from '../constants/queue.constant';

@Entity('queues')
@Index('idx_queue_tenant_id', ['tenantId'])
export class Queue {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ type: 'varchar', length: 100 })
	name!: string;

	@Column({ type: 'varchar', length: 255, nullable: true })
	description: string | null = null;

	@Column({ type: 'enum', enum: QueueStrategy, default: QueueStrategy.RingAll })
	strategy: QueueStrategy = QueueStrategy.RingAll;

	@Column({ name: 'ring_timeout_seconds', type: 'int', default: DEFAULT_RING_TIMEOUT_SECONDS })
	ringTimeoutSeconds: number = DEFAULT_RING_TIMEOUT_SECONDS;

	@Column({ name: 'max_wait_time_seconds', type: 'int', default: DEFAULT_MAX_WAIT_TIME_SECONDS })
	maxWaitTimeSeconds: number = DEFAULT_MAX_WAIT_TIME_SECONDS;

	@Column({ name: 'max_callers', type: 'int', nullable: true })
	maxCallers: number | null = null;

	@Column({ name: 'music_on_hold_id', type: 'uuid', nullable: true })
	musicOnHoldId: string | null = null;

	@Column({ name: 'round_robin_cursor_member_id', type: 'uuid', nullable: true })
	roundRobinCursorMemberId: string | null = null;

	@Column({ type: 'boolean', default: true })
	enabled = true;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
