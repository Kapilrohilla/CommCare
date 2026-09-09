import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'ps_endpoint_id_ips', synchronize: false })
export class PsEndpointIdIp {
	@PrimaryColumn({ type: 'varchar', length: 40 })
	id!: string;

	@Column({ type: 'varchar', length: 40, nullable: true })
	endpoint: string | null = null;

	@Column({ type: 'varchar', length: 80, nullable: true })
	match: string | null = null;

	@Column({ name: 'srv_lookups', type: 'varchar', length: 40, nullable: true })
	srvLookups: string | null = 'yes';

	@Column({ name: 'match_header', type: 'varchar', length: 255, nullable: true })
	matchHeader: string | null = null;
}
