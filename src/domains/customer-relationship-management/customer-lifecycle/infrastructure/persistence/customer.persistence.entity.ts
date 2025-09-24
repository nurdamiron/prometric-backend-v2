import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

/**
 * PURE PERSISTENCE ENTITY - NO BUSINESS LOGIC!
 * This is ONLY for TypeORM database mapping.
 * All business logic is in the Customer Aggregate.
 */
@Entity('customers')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
@Index(['email'])
@Index(['phone'])
@Index(['assignedTo'])
export class CustomerPersistenceEntity {
  @PrimaryColumn('uuid')
  id: string;

  // Organization relationship
  @Column({ name: 'organization_id' })
  organizationId: string;

  // Basic Information
  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 20, nullable: true })
  phone?: string;

  // Business Information
  @Column({ name: 'company_name', length: 255, nullable: true })
  companyName?: string;

  @Column({ length: 12, nullable: true })
  bin?: string;

  // Status and Progress
  @Column({ length: 50, default: 'lead' })
  status: string;

  @Column({ name: 'lead_score', type: 'int', default: 0 })
  leadScore: number;

  // Financial
  @Column({ name: 'total_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalValue: number;

  @Column({ name: 'potential_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
  potentialValue: number;

  // Contact tracking
  @Column({ name: 'last_contact_date', nullable: true })
  lastContactDate?: Date;

  @Column({ name: 'next_followup_date', nullable: true })
  nextFollowUpDate?: Date;

  // Assignment
  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo?: string;

  // Notes and metadata
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ name: 'custom_fields', type: 'jsonb', nullable: true })
  customFields?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete
  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}