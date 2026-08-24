import {
	Column,
	CreateDateColumn,
	Entity,
	OneToMany,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from 'typeorm';
import { VisitorAppType, VisitorIdentifierType } from '../constants/visitor.constant';
import { SessionEntity } from './session.entity';

@Entity('visitors')
@Unique('uix_visitor_identifier', ['identifierType', 'identifier'])
export class VisitorEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'varchar', length: 255, nullable: false })
	identifier!: string;

	@Column({ type: 'enum', enum: VisitorIdentifierType, nullable: false })
	identifierType!: VisitorIdentifierType;

	@CreateDateColumn({ type: 'timestamptz' })
	firstSeenAt!: Date;

	@UpdateDateColumn({ type: 'timestamptz' })
	lastSeenAt!: Date;

	@Column({ type: 'enum', enum: VisitorAppType, nullable: false })
	appType!: VisitorAppType;

	@Column({ type: 'text', nullable: true })
	userAgent!: string | null;

	@Column({ type: 'json', nullable: true })
	metadata!: Record<string, unknown> | null;

	@OneToMany(() => SessionEntity, (session) => session.visitor)
	sessions!: SessionEntity[];
}
