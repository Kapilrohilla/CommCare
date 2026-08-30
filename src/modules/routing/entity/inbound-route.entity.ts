import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import {
	InboundRouteDestinationType,
	InboundRouteSourceType,
} from '../constants/inbound-routes.constant';

@Entity('inbound_routes')
export class InboundRoute {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'tenant_id', type: 'uuid' })
	tenantId!: string;

	@Column({ name: 'source_type', type: 'enum', enum: InboundRouteSourceType })
	sourceType!: InboundRouteSourceType;

	@Column({ name: 'source_id', type: 'uuid', nullable: true })
	sourceId: string | null = null;

	@Column({ name: 'source_value', type: 'varchar', length: 64, nullable: true })
	sourceValue: string | null = null;

	@Column({ name: 'destination_type', type: 'enum', enum: InboundRouteDestinationType })
	destinationType!: InboundRouteDestinationType;

	@Column({ name: 'destination_id', type: 'uuid', nullable: true })
	destinationId: string | null = null;

	@Column({ name: 'destination_value', type: 'varchar', length: 64, nullable: true })
	destinationValue: string | null = null;

	@Column({ type: 'boolean', default: true })
	enabled = true;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt!: Date;
}
