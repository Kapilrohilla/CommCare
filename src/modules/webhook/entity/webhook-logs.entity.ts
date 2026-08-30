import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class WebhookLogs {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ type: 'uuid', nullable: false })
	webhookRegistryId!: string;

	@Column({ type: 'uuid', nullable: false })
	tenantId!: string;

	@Column({type: 'text',nullable: false})
	requestEndpoint!: string;

	@Column({type: 'text',nullable: false})
	requestMethod!: string;

	@Column({ type: 'json', nullable: false })
	requestPayload!: Record<string, any>;

	@Column({ type: 'json', nullable: false })
	requestHeaders!: Record<string, any>;

	@Column({ type: 'json', nullable: false })
	responsePayload!: Record<string, any>;

	@Column({ type: 'integer', nullable: false })
	responseStatusCode!: number;

	@Column({ type: 'timestamp', nullable: false })
	createdAt!: Date;
}
