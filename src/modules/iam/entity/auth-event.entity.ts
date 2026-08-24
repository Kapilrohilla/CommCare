import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { AuthEventSubject } from '../constants/auth-event.constant';
import { UserEntity } from './user.entity';
import { IdentityEntity } from './identity.entity';

@Entity('auth_events')
export class AuthEventEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'uuid', nullable: true })
	userId!: string | null;

	@Column({ type: 'uuid', nullable: true })
	identityId!: string | null;

	@Column({ type: 'uuid', nullable: true })
	tenantId!: string | null;

	@Column({ type: 'enum', enum: AuthEventSubject, nullable: false })
	subject!: AuthEventSubject;

	@Column({ type: 'boolean', nullable: false, default: false })
	success!: boolean;

	@Column({ type: 'text', nullable: true })
	failureReason!: string | null;

	@ManyToOne(() => UserEntity, { nullable: true })
	@JoinColumn({ name: 'user_id' })
	user!: UserEntity | null;

	@ManyToOne(() => IdentityEntity, { nullable: true })
	@JoinColumn({ name: 'identity_id' })
	identity!: IdentityEntity | null;

	@CreateDateColumn({ type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ type: 'timestamptz' })
	updatedAt!: Date;
}
