import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('queue_members')
@Index('idx_queue_member_queue_id', ['queueId'])
@Index('idx_queue_member_agent_id', ['agentId'])
export class QueueMember {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'queue_id', type: 'uuid' })
	queueId!: string;

	@Column({ name: 'agent_id', type: 'uuid' })
	agentId!: string;

	@Column({ type: 'int', default: 0 })
	priority = 0;

	@Column({ type: 'int', default: 0 })
	penalty = 0;

	@Column({ type: 'boolean', default: true })
	enabled = true;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
