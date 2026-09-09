import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { SipTrunkAuthMode } from '../constants/sip-trunk.constant';
import { SipTrunkIdentifyIp } from './sip-trunk-identify-ip.entity';

@Entity({ name: 'sip_trunks' })
@Index('idx_sip_trunks_tenant_id', ['tenantId'])
export class SipTrunk {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ type: 'varchar', length: 128 })
	name!: string;

	@Column({ name: 'auth_mode', type: 'enum', enum: SipTrunkAuthMode })
	authMode!: SipTrunkAuthMode;

	@Column({ type: 'varchar', length: 80, nullable: true })
	username: string | null = null;

	@Column({ type: 'varchar', length: 128, nullable: true })
	password: string | null = null;

	@Column({ type: 'boolean', default: true })
	enabled = true;

	/** Asterisk PJSIP endpoint id (max 40 chars), e.g. trunk-{uuidWithoutDashes}. */
	@Column({ name: 'pjsip_endpoint_id', type: 'varchar', length: 40 })
	pjsipEndpointId!: string;

	@OneToMany(() => SipTrunkIdentifyIp, (ip) => ip.trunk, {
		cascade: true,
		eager: true,
	})
	identifyIps!: SipTrunkIdentifyIp[];

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
