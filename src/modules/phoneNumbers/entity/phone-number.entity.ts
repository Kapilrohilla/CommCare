import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from 'typeorm';
import { PhoneNumberStatus, PhoneNumberType } from '../constants/phone-number.constant';

@Entity({ name: 'phone_numbers' })
@Index('idx_phone_numbers_tenant_id', ['tenantId'])
@Index('idx_phone_numbers_number', ['number'])
@Unique('uq_phone_numbers_number', ['number'])
export class PhoneNumber {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'sip_trunk_id', type: 'uuid' })
	sipTrunkId!: string;

	/** Normalized E.164, e.g. "+14155551234". */
	@Column({ type: 'varchar', length: 20 })
	number!: string;

	@Column({ type: 'enum', enum: PhoneNumberType, default: PhoneNumberType.Did })
	type: PhoneNumberType = PhoneNumberType.Did;

	@Column({ type: 'enum', enum: PhoneNumberStatus, default: PhoneNumberStatus.Active })
	status: PhoneNumberStatus = PhoneNumberStatus.Active;

	@Column({ type: 'varchar', length: 128 })
	name!: string;

	@Column({ type: 'varchar', length: 255, nullable: true })
	description: string | null = null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
