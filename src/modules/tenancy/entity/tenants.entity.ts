import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenants')
export class Tenants {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ length: 255 })
	name!: string;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;
}
