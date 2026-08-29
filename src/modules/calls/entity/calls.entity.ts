import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { CallDirection, CallStatus, CallWorkflow } from "../constants/call.constant";

@Entity('calls')
export class CallEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null = null;

  @Column({
    type: 'enum',
    enum: CallWorkflow,
    default: CallWorkflow.CLICK_TO_CALL,
  })
  workflow: CallWorkflow = CallWorkflow.CLICK_TO_CALL;

  /**
   * Asterisk logical call identifier.
   * Example: 1787500684.41
   */
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  linkedId: string | null = null;

  /**
   * Your normalized call direction.
   */
  @Column({
    type: 'enum',
    enum: CallDirection,
  })
  direction!: CallDirection;

  /**
   * Original caller information.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  callerNumber: string | null = null;

  @Column({ type: 'uuid', nullable: true })
  callerUserId: string | null = null;

  /**
   * Original destination.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  callToNumber: string | null = null;

  @Column({ type: 'uuid', nullable: true })
  callToUserId: string | null = null;

  /**
   * Technical call status.
   */
  @Column({
    type: 'enum',
    enum: CallStatus,
  })
  status!: CallStatus;

  /**
   * ARI channel ids for click2call legs (stored on call for workflow state).
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  callerChannelId: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  calleeChannelId: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bridgeId: string | null = null;

  /**
   * Timing.
   */
  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null = null;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt: Date | null = null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null = null;

  /**
   * Seconds.
   */
  @Column({ type: 'integer', default: 0 })
  duration: number = 0;

  @Column({ type: 'integer', default: 0 })
  billableSeconds: number = 0;

  /**
   * Asterisk information.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  source: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  destination: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  context: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  accountCode: string | null = null;

  /**
   * Application-level agent.
   */
  @Column({ type: 'uuid', nullable: true })
  agentId: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  agentExtension: string | null = null;

  /**
   * Recording.
   */
  @Column({ type: 'boolean', default: false })
  recordingAvailable: boolean = false;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recordingUrl: string | null = null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
