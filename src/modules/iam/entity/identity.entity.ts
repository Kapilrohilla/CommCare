import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from 'typeorm';
import { IdentifierType } from '../constants/identity.constant';
import { UserEntity } from './user.entity';

@Entity('identities')
@Unique('uix_identity_identifier', ['identifierType', 'identifier'])
export class IdentityEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'uuid', nullable: true })
	userId!: string | null;

	@Column({ type: 'enum', enum: IdentifierType, nullable: false })
	identifierType!: IdentifierType;

	@Column({ type: 'varchar', length: 255, nullable: false })
	identifier!: string;

	@Column({ type: 'varchar', length: 255, nullable: true, default: null })
	secretHash!: string | null;

	@Column({ type: 'timestamptz', nullable: true, default: null })
	identityVerifiedAt!: Date | null;

	@Column({ type: 'timestamptz', nullable: true, default: null })
	lastLoginAt!: Date | null;

	@Column({ type: 'timestamptz', nullable: true, default: null })
	lockedUntil!: Date | null;

	@Column({ type: 'int', nullable: false, default: 0 })
	consecutiveFailedCount!: number;

	@ManyToOne(() => UserEntity, { nullable: true })
	@JoinColumn({ name: 'user_id' })
	user!: UserEntity | null;

	@CreateDateColumn({ type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ type: 'timestamptz' })
	updatedAt!: Date;
}
