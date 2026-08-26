import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ExtensionStatus, ExtensionTransport, ExtensionType } from "../constants/extension.constant";

export interface UserInfo {
	name: string;
	userId: string;
}

@Entity()
@Index('idx_extension_tenant_id', ['tenantId'])
@Index('idx_extension_user_id', ['userId'])
@Index('idx_extension_extension', ['extension'])
@Index('idx_extension_status', ['status'])
export class Extension {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'uuid', nullable: true })
	tenantId!: string | null;

	@Column({ type: 'uuid', nullable: true })
	userId!: string | null;

	@Column({ type: 'json', nullable: true })
	userInfo: UserInfo | null = null;

	@Column({type: 'varchar', nullable: false})
	extension!: string;

	@Column({type: 'varchar', nullable: true})
	description!: string | null;

	@Column({type: 'enum', nullable: false, enum: ExtensionType})
	type!: ExtensionType;

	@Column({type: 'enum', nullable: false, enum: ExtensionStatus})
	status!: ExtensionStatus;

	// Asterisk fields
	@Column({type: 'varchar', nullable: false})
	asteriskHost!: string;

	@Column({type: 'int', nullable: false})
	asteriskPort!: number;

	@Column({type: 'enum', nullable: false, enum: ExtensionTransport})
	asteriskTransport!: ExtensionTransport;

	// PJSIP fields
	@Column({type: 'varchar', nullable: false})
	pjsipEndpoint!: string;

	@Column({type: 'varchar', nullable: false})
	pjsipUsername!: string;

	@Column({type: 'varchar', nullable: false})
	pjsipPassword!: string;

	// Caller ID fields
	@Column({type: 'varchar', nullable: true})
	callerIdName!: string | null;

	@Column({type: 'varchar', nullable: true})
	callerIdNumber!: string | null;

	// Timestamps
	@CreateDateColumn({type: 'timestamp', nullable: false})
	createdAt!: Date;

	@UpdateDateColumn({type: 'timestamp', nullable: false})
	updatedAt!: Date;
}