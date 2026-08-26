import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';


@Entity('tenants')
export class Tenants {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ length: 255 })
	name!: string;

	@Column({ type: 'int', nullable: false, default: 0 })
	assignedExtensionCount: number = 0;

	@Column({type: 'int', nullable: false, default: 0})
	reservedExtensionCount: number = 0;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;
}
