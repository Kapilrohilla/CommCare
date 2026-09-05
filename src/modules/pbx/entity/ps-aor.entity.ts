import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'ps_aors', synchronize: false })
export class PsAor {
	@PrimaryColumn({ type: 'varchar', length: 40 })
	id!: string;

	@Column({ name: 'max_contacts', type: 'int', nullable: true })
	maxContacts: number | null = 3;

	@Column({ name: 'remove_existing', type: 'varchar', length: 40, nullable: true })
	removeExisting: string | null = 'yes';

	@Column({ name: 'default_expiration', type: 'int', nullable: true })
	defaultExpiration: number | null = 3600;
}
