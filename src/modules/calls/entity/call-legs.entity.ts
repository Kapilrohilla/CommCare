import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { CallLegStatus } from "../constants/call.constant";

@Entity('call_legs')
export class CallLegEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  callId!: string;

  /**
   * Asterisk identifiers.
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  uniqueId!: string;

  @Column({ type: 'varchar', length: 100 })
  linkedId!: string;

  /**
   * Channel.
   */
  @Column({ type: 'varchar', length: 255 })
  channel!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  destinationChannel!: string | null;

  /**
   * Caller.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  callerNumber!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  callerName!: string | null;

  /**
   * Destination.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  destinationNumber!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  destinationName!: string | null;

  /**
   * Leg-level status.
   */
  @Column({
    type: 'enum',
    enum: CallLegStatus,
    default: CallLegStatus.CREATED,
  })
  status!: CallLegStatus;

  /**
   * Timing.
   */
  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  duration!: number;

  @Column({ type: 'integer', default: 0 })
  billableSeconds!: number;

  /**
   * Hangup.
   */
  @Column({ type: 'integer', nullable: true })
  hangupCause!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  hangupCauseText!: string | null;

  /**
   * Dial information.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  dialString!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dialStatus!: string | null;

  /**
   * Bridge.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  bridgeUniqueId!: string | null;

  /**
   * Original channel metadata.
   */
  @Column({ type: 'jsonb', nullable: true })
  raw!: Record<string, any> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}