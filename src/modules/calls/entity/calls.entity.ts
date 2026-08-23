import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { CallDirection, CallStatus } from "../constants/call.constant";

@Entity('calls')
export class CallEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Asterisk logical call identifier.
   * Example: 1787500684.41
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  linkedId!: string;

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
  from!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fromName!: string | null;

  /**
   * Original destination.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  to!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  toName!: string | null;

  /**
   * Technical call status.
   */
  @Column({
    type: 'enum',
    enum: CallStatus,
  })
  status!: CallStatus;

  /**
   * Timing.
   */
  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  /**
   * Seconds.
   */
  @Column({ type: 'integer', default: 0 })
  duration!: number;

  @Column({ type: 'integer', default: 0 })
  billableSeconds!: number;

  /**
   * Asterisk information.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  source!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  destination!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  context!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  accountCode!: string | null;

  /**
   * Application-level agent.
   */
  @Column({ type: 'uuid', nullable: true })
  agentId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  agentExtension!: string | null;

  /**
   * Business disposition.
   */
  @Column({ type: 'uuid', nullable: true })
  dispositionId!: string | null;

  @Column({ type: 'text', nullable: true })
  dispositionNote!: string | null;

  /**
   * Optional external references.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  customerId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  leadId!: string | null;

  /**
   * Recording.
   */
  @Column({ type: 'boolean', default: false })
  recordingAvailable!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}