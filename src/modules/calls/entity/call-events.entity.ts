
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('call_events')
export class CallEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  callId!: string;

  @Column({ type: 'uuid', nullable: true })
  callLegId!: string | null;

  /**
   * Asterisk identifiers.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  linkedId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  uniqueId!: string | null;

  /**
   * Example:
   *
   * Newchannel
   * DialBegin
   * Newstate
   * BridgeEnter
   * Hangup
   * Cdr
   */
  @Column({ type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'timestamptz' })
  eventTime!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  channel!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bridgeUniqueId!: string | null;

  /**
   * Complete AMI event.
   */
  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;
}