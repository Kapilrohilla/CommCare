import { BaseEntity, Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { CallDirection } from "../constants/call.constant";

export class CallEntity extends BaseEntity {
	@PrimaryGeneratedColumn('uuid', { name: 'id' })
	id!: string;

	@Column({ type: 'enum', enum: CallDirection , name: 'direction' })
	direction!: CallDirection;

	@Column({ type: 'varchar', length: 255 ,name: 'from'})
	from!: string;

	@Column({ type: 'varchar', length: 255 ,name: 'to'})
	to!: string;

	@Column({ type: 'varchar', length: 255 ,name: 'pbxCallId'})
	pbxCallId?: string;

	@Column({ type: 'jsonb' ,name: 'raw'})
	raw!: Record<string, any>;
	
	@CreateDateColumn({ name: 'createdAt' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updatedAt' })
	updatedAt!: Date;
}