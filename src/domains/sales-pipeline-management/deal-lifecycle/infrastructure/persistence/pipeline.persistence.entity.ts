import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  JoinColumn
} from 'typeorm';
// Remove this import - DealPersistenceEntity is defined in this file

/**
 * PIPELINE PERSISTENCE ENTITY
 * Represents sales pipelines in the system
 */
@Entity('pipelines')
@Index(['organizationId', 'isDefault'])
@Index(['organizationId', 'orderIndex'])
export class PipelinePersistenceEntity {
  @PrimaryColumn('uuid')
  id: string;

  // Organization relationship
  @Column({ name: 'organization_id' })
  organizationId: string;

  // Pipeline Information
  @Column({ name: 'name', length: 255 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  // Pipeline Configuration
  @Column({ name: 'config', type: 'jsonb', nullable: true })
  config?: {
    allowReorder: boolean;
    strictWipLimits: boolean;
    autoCalculateProbabilities: boolean;
    wipLimits?: Record<string, number>;
  };

  // Stages Configuration
  @Column({ name: 'stages', type: 'jsonb' })
  stages: Array<{
    id: string;
    name: string;
    slug: string;
    colorHex: string;
    probability: number;
    type: 'normal' | 'won' | 'lost';
    orderIndex: number;
    isActive: boolean;
    wipLimit?: number;
    i18n?: Record<string, string>;
  }>;

  // Status
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Audit fields
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete
  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relationships
  @OneToMany(() => DealPersistenceEntity, deal => deal.pipelineId)
  deals: DealPersistenceEntity[];
}

/**
 * DEAL PERSISTENCE ENTITY
 * Represents deals/opportunities in the sales pipeline
 */
@Entity('deals')
@Index(['organizationId', 'pipelineId'])
@Index(['organizationId', 'stageId'])
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
@Index(['organizationId', 'expectedCloseDate'])
export class DealPersistenceEntity {
  @PrimaryColumn('uuid')
  id: string;

  // Organization relationship
  @Column({ name: 'organization_id' })
  organizationId: string;

  // Pipeline relationship
  @Column({ name: 'pipeline_id' })
  pipelineId: string;

  @Column({ name: 'stage_id' })
  stageId: string;

  // Deal Information
  @Column({ name: 'title', length: 255 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'value', type: 'decimal', precision: 15, scale: 2, nullable: true })
  value?: number;

  @Column({ name: 'currency', length: 3, default: 'KZT' })
  currency: string;

  @Column({ name: 'probability', type: 'int', default: 0 })
  probability: number;

  // Relationships
  @Column({ name: 'customer_id', nullable: true })
  customerId?: string;

  @Column({ name: 'contact_id', nullable: true })
  contactId?: string;

  // Assignment
  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo?: string;

  // Dates
  @Column({ name: 'expected_close_date', nullable: true })
  expectedCloseDate?: Date;

  @Column({ name: 'actual_close_date', nullable: true })
  actualCloseDate?: Date;

  // Status
  @Column({ name: 'status', length: 50, default: 'active' })
  status: string; // active, won, lost, paused, cancelled

  @Column({ name: 'source', length: 100, nullable: true })
  source?: string; // website, referral, cold_call, etc.

  // Metadata
  @Column({ name: 'tags', type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ name: 'custom_fields', type: 'jsonb', nullable: true })
  customFields?: Record<string, any>;

  // Activity tracking
  @Column({ name: 'last_activity_at', nullable: true })
  lastActivityAt?: Date;

  @Column({ name: 'activities_count', type: 'int', default: 0 })
  activitiesCount: number;

  // Audit fields
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete
  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relationships
  @OneToMany(() => DealActivityEntity, activity => activity.dealId)
  activities: DealActivityEntity[];
}

/**
 * DEAL ACTIVITY PERSISTENCE ENTITY
 * Represents activities/tasks related to deals
 */
@Entity('deal_activities')
@Index(['organizationId', 'dealId'])
@Index(['organizationId', 'type'])
@Index(['organizationId', 'createdAt'])
export class DealActivityEntity {
  @PrimaryColumn('uuid')
  id: string;

  // Organization relationship
  @Column({ name: 'organization_id' })
  organizationId: string;

  // Deal relationship
  @Column({ name: 'deal_id' })
  dealId: string;

  // Activity Information
  @Column({ name: 'type', length: 50 })
  type: string; // call, email, meeting, task, note, etc.

  @Column({ name: 'title', length: 255 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'status', length: 50, default: 'pending' })
  status: string; // pending, completed, cancelled

  // Assignment
  @Column({ name: 'assigned_to' })
  assignedTo: string;

  // Dates
  @Column({ name: 'due_date', nullable: true })
  dueDate?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  // Metadata
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Audit fields
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete
  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}