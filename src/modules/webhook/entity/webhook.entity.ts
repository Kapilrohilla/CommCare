import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { WebhookRegistryEventTrigger, WebhookRegistryMethod, WebhookRegistryStatus } from "../constants/webhook.constant";

@Entity()
export class WebhookRegistry {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ type: 'varchar', nullable: false })
	name!: string;

	@Column({ type: 'text', nullable: true })
	description?: string | null;

	@Column({type: 'uuid', nullable: false})
	tenantId!: string;

	@Column({ type: 'enum', nullable: false, enum: WebhookRegistryEventTrigger })
	triggerEvent!: WebhookRegistryEventTrigger;

	@Column({type: 'enum', nullable: false, enum: WebhookRegistryMethod})
	method!: WebhookRegistryMethod;

	@Column({ type: 'text', nullable: false })
	endpoint!: string;

	@Column({ type: 'json', nullable: true })
	headers?: Record<string, string> | null;

	@Column({type: 'enum', nullable: false, enum: WebhookRegistryStatus})
	status!: WebhookRegistryStatus;

	@Column({type: 'timestamp', nullable: true})
	pauseWebhookAt?: Date | null;

	@Column({type: 'uuid', nullable: false})
	createdBy!: string;

	@Column({type: 'uuid', nullable: false})
	updatedBy!: string;

	@CreateDateColumn({type: 'timestamp', nullable: false})
	createdAt!: Date;

	@UpdateDateColumn({type: 'timestamp', nullable: false})
	updatedAt!: Date;
}
