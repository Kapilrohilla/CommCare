import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface ExtensionStats {
	assigned: number;
	reserved: number;
}

@Entity('tenants')
export class Tenants {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ length: 255 })
	name!: string;

	@Column({ type: 'json', nullable: false, default: null })
	extensionStats: ExtensionStats | null = null;
	
	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;
}
