import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { ConversationStatus } from '../../domain/conversation.domain';
import type { ConversationMetadata } from '../../domain/conversation.domain';

@Entity('ai_conversation_sessions')
@Index('idx_ai_conversations_user_org', ['userId', 'organizationId'])
@Index('idx_ai_conversations_status', ['status'])
@Index('idx_ai_conversations_last_message', ['lastMessageAt'])
export class ConversationSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index('idx_ai_conversations_user')
  userId: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  @Index('idx_ai_conversations_organization')
  organizationId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.ACTIVE
  })
  status: ConversationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', name: 'last_message_at', default: () => 'CURRENT_TIMESTAMP' })
  lastMessageAt: Date;

  @Column({ type: 'integer', name: 'messages_count', default: 0 })
  messagesCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: ConversationMetadata;

  // Relations
  @OneToMany(() => ConversationMessageEntity, message => message.session)
  messages: ConversationMessageEntity[];
}

@Entity('ai_conversation_messages')
@Index('idx_ai_messages_session_timestamp', ['sessionId', 'timestamp'])
@Index('idx_ai_messages_role', ['role'])
export class ConversationMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  @Column({
    type: 'enum',
    enum: ['user', 'assistant', 'system']
  })
  role: 'user' | 'assistant' | 'system';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    tokens?: number;
    model?: string;
    processingTime?: number;
    functions?: Array<{
      name: string;
      parameters: Record<string, any>;
      result?: any;
      executedAt?: Date;
      error?: string;
      success: boolean;
    }>;
    sources?: Array<{
      documentId: string;
      title: string;
      relevanceScore: number;
      chunkId?: string;
      excerpt: string;
    }>;
    confidence?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    intent?: string;
  };

  // Relations
  @OneToMany(() => ConversationSessionEntity, session => session.messages)
  session: ConversationSessionEntity;
}