import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CallDirection } from '../constants/call.constant';

@Entity('calls')
export class CallEntity {
	@PrimaryGeneratedColumn('uuid', { name: 'id' })
	id!: string;

	@Column({ type: 'timestamp with time zone', name: 'callDate' })
	callDate!: string;


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