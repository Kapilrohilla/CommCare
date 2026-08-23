import { Column, CreateDateColumn, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { IdentifierType } from "../constants/identity.constant";
import { UserEntity } from "./user.entity";

export class IdentityEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'uuid', nullable: true})
	userId!: string;

	@Column({type: 'enum', enum: IdentifierType, nullable: false})
	identifierType!: IdentifierType;

	@Column({ type: 'varchar', length: 255 , nullable: false})
	identifier!: string ;

	@Column({ type: 'varchar', length: 255, nullable: true, default: null})
	secretHash!: string | null;

	@Column({ type: 'timestamptz', nullable: true, default: null })
	identityVerifiedAt!: Date | null;

	// TODO: Introduce IdentityStatus enum later
	// @Column({type: 'enum', enum: IdentityStatus, default: IdentityStatus.PENDING})
	// identityStatus!: IdentityStatus;

	@Column({ type: 'timestamptz', nullable: true, default: null })
	lastLoginAt!: Date | null;

	@Column({ type: 'timestamptz', nullable: true, default: null })
	lockedUntil!: Date | null;

	@Column({ type: 'int', nullable: false, default: 0 })
	consecutiveFailedCount!: number;

	@ManyToOne(() => UserEntity, (user) => user.id)
	@JoinColumn({ name: 'user_id' })
	user!: UserEntity;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}