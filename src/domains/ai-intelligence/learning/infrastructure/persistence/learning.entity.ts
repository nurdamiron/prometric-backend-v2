import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { LearningEventType } from '../../domain/learning.domain';
import type { LearningPayload, LearningMetadata } from '../../domain/learning.domain';

@Entity('ai_learning_events')
@Index('idx_learning_events_user_org', ['userId', 'organizationId'])
@Index('idx_learning_events_type', ['eventType'])
@Index('idx_learning_events_processed', ['processed'])
@Index('idx_learning_events_timestamp', ['timestamp'])
export class LearningEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({
    type: 'enum',
    enum: LearningEventType,
    name: 'event_type'
  })
  eventType: LearningEventType;

  @Column({ type: 'jsonb' })
  payload: LearningPayload;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @Column({ type: 'jsonb' })
  metadata: LearningMetadata;
}