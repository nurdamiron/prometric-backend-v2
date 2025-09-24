import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('sales_pipelines')
@Index(['organizationId'])
export class SalesPipeline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('sales_stages')
@Index(['pipelineId'])
@Index(['pipelineId', 'orderIndex'])
export class SalesStage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pipeline_id' })
  pipelineId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  slug: string;

  @Column({ name: 'color_hex', length: 7, default: '#64748B' })
  colorHex: string;

  @Column({ type: 'int', default: 50 })
  probability: number;

  @Column({
    type: 'enum',
    enum: ['normal', 'won', 'lost'],
    default: 'normal'
  })
  type: 'normal' | 'won' | 'lost';

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ name: 'wip_limit', nullable: true })
  wipLimit: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  i18n: {
    ru?: string;
    kk?: string;
    en?: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('sales_deals')
@Index(['organizationId'])
@Index(['pipelineId'])
@Index(['stageId'])
@Index(['customerId'])
@Index(['status'])
export class SalesDeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'pipeline_id' })
  pipelineId: string;

  @Column({ name: 'stage_id' })
  stageId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'deal_name', length: 200 })
  dealName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column({ length: 3, default: 'KZT' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['active', 'won', 'lost', 'archived'],
    default: 'active'
  })
  status: 'active' | 'won' | 'lost' | 'archived';

  @Column({ type: 'int', default: 50 })
  probability: number;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'expected_close_date', type: 'date', nullable: true })
  expectedCloseDate: Date;

  @Column({ name: 'closed_date', type: 'date', nullable: true })
  closedDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}