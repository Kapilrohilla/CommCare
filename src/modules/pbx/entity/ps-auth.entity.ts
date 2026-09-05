import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'ps_auths', synchronize: false })
export class PsAuth {
	@PrimaryColumn({ type: 'varchar', length: 40 })
	id!: string;

	@Column({ name: 'auth_type', type: 'varchar', length: 40, nullable: true })
	authType: string | null = 'userpass';

	@Column({ type: 'varchar', length: 40, nullable: true })
	username: string | null = null;

	@Column({ type: 'varchar', length: 80, nullable: true })
	password: string | null = null;

	@Column({ name: 'nonce_lifetime', type: 'int', nullable: true })
	nonceLifetime: number | null = 32;
}
