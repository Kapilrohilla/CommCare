import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { AuthEventSubject } from "../constants/auth-event.constant";
import { UserEntity } from "./user.entity";
import { IdentityEntity } from "./identity.entity";

@Entity()
export class AuthEventEntity{
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'uuid', nullable: true })
	userId!: string;

	@Column({ type: 'uuid', nullable: true })
	identityId!: string;

	@Column({ type: 'uuid', nullable: true })
	tenantId!: string;

	@Column({ type: 'enum', enum: AuthEventSubject, nullable: false })
	subject!: AuthEventSubject;

	@Column({ type: 'boolean', nullable: false, default: false })
	success!: boolean;

	@Column({ type: 'text', nullable: true })
	failureReason!: string | null;

	@ManyToOne(() => UserEntity, (user) => user.id)
	@JoinColumn({ name: 'user_id' })
	user!: UserEntity;

	@ManyToOne(() => IdentityEntity, (identity) => identity.id)
	@JoinColumn({ name: 'identity_id' })
	identity!: IdentityEntity;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}