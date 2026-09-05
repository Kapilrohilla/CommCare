import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'ps_endpoints', synchronize: false })
export class PsEndpoint {
	@PrimaryColumn({ type: 'varchar', length: 40 })
	id!: string;

	@Column({ type: 'varchar', length: 40, nullable: true })
	transport: string | null = 'transport-udp';

	@Column({ type: 'varchar', length: 200, nullable: true })
	aors: string | null = null;

	@Column({ type: 'varchar', length: 40, nullable: true })
	auth: string | null = null;

	@Column({ type: 'varchar', length: 40, nullable: true })
	context: string | null = 'from-internal';

	@Column({ type: 'varchar', length: 200, nullable: true })
	disallow: string | null = 'all';

	@Column({ type: 'varchar', length: 200, nullable: true })
	allow: string | null = 'ulaw,alaw,gsm';

	@Column({ name: 'direct_media', type: 'varchar', length: 40, nullable: true })
	directMedia: string | null = 'no';

	@Column({ name: 'rtp_symmetric', type: 'varchar', length: 40, nullable: true })
	rtpSymmetric: string | null = 'yes';

	@Column({ name: 'force_rport', type: 'varchar', length: 40, nullable: true })
	forceRport: string | null = 'yes';

	@Column({ name: 'rewrite_contact', type: 'varchar', length: 40, nullable: true })
	rewriteContact: string | null = 'yes';

	@Column({ type: 'varchar', length: 100, nullable: true })
	callerid: string | null = null;

	@Column({ name: 'media_use_received_transport', type: 'varchar', length: 40, nullable: true })
	mediaUseReceivedTransport: string | null = 'yes';
}
