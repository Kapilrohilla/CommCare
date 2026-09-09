import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Unique,
} from 'typeorm';
import { SipTrunk } from './sip-trunk.entity';

@Entity({ name: 'sip_trunk_identify_ips' })
@Unique('uq_sip_trunk_identify_ips_trunk_match', ['trunkId', 'match'])
@Index('idx_sip_trunk_identify_ips_trunk_id', ['trunkId'])
export class SipTrunkIdentifyIp {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'trunk_id', type: 'uuid' })
	trunkId!: string;

	@ManyToOne(() => SipTrunk, (trunk) => trunk.identifyIps, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'trunk_id' })
	trunk!: SipTrunk;

	/** Asterisk identify `match` value (IP or CIDR). */
	@Column({ type: 'varchar', length: 80 })
	match!: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;
}
