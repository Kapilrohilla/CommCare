import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { IdentityEntity } from './identity.entity';
import { VisitorEntity } from './visitor.entity';

@Entity('sessions')
export class SessionEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'uuid', nullable: false })
	visitorId!: string;

	@Column({ type: 'uuid', nullable: false })
	userId!: string;

	@Column({ type: 'uuid', nullable: false })
	identityId!: string;

	@Column({ type: 'uuid', nullable: true })
	tenantId!: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	deviceName!: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	browser!: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	os!: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	ip!: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	userAgent!: string | null;

	@Column({ type: 'timestamptz', nullable: false })
	lastSeenAt!: Date;

	@Column({ type: 'timestamptz', nullable: true })
	expiresAt!: Date | null;

	@Column({ type: 'timestamptz', nullable: true })
	revokedAt!: Date | null;

	@ManyToOne(() => UserEntity, (user) => user.sessions)
	@JoinColumn({ name: 'user_id' })
	user!: UserEntity;

	@ManyToOne(() => IdentityEntity)
	@JoinColumn({ name: 'identity_id' })
	identity!: IdentityEntity;

	@ManyToOne(() => VisitorEntity, (visitor) => visitor.sessions)
	@JoinColumn({ name: 'visitor_id' })
	visitor!: VisitorEntity;

	@CreateDateColumn({ type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ type: 'timestamptz' })
	updatedAt!: Date;
}
