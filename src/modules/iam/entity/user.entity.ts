import {
	Column,
	CreateDateColumn,
	Entity,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { UserStatus } from '../constants/user.constant';
import { IdentityEntity } from './identity.entity';
import { SessionEntity } from './session.entity';

@Entity('users')
export class UserEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'uuid', nullable: true })
	tenantId!: string | null;

	@Column({ type: 'varchar', length: 255 })
	name!: string;

	@Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
	status!: UserStatus;

	@OneToMany(() => IdentityEntity, (identity) => identity.user)
	identities!: IdentityEntity[];

	@OneToMany(() => SessionEntity, (session) => session.user)
	sessions!: SessionEntity[];

	@CreateDateColumn({ type: 'timestamptz' })
	createdAt!: Date;

	@UpdateDateColumn({ type: 'timestamptz' })
	updatedAt!: Date;
}
