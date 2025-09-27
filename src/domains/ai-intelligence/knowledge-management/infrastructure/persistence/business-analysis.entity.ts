import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

/**
 * BUSINESS ANALYSIS ENTITY
 * Stores AI-powered business analysis results
 */
@Entity('business_analyses')
@Index(['organizationId', 'domain'])
@Index(['organizationId', 'createdAt'])
@Index(['organizationId', 'language'])
export class BusinessAnalysisEntity {
  @PrimaryColumn('uuid')
  id: string;

  // Organization relationship
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'user_id' })
  userId: string;

  // Website Information
  @Column({ name: 'url', length: 500 })
  url: string;

  @Column({ name: 'domain', length: 255 })
  domain: string;

  // Business Analysis Results
  @Column({ name: 'business_type', length: 100 })
  businessType: string;

  @Column({ name: 'industry', length: 100 })
  industry: string;

  @Column({ name: 'products_services', type: 'text' })
  productsServices: string; // JSON array

  @Column({ name: 'target_market', length: 255 })
  targetMarket: string;

  @Column({ name: 'company_size', length: 50 })
  companySize: string;

  @Column({ name: 'business_keywords', type: 'text' })
  businessKeywords: string; // JSON array

  @Column({ name: 'language', length: 10 })
  language: string; // ru/kk/en

  @Column({ name: 'word_count', type: 'int' })
  wordCount: number;

  // AI Analysis Results
  @Column({ name: 'ai_analysis', type: 'text' })
  aiAnalysis: string;

  @Column({ name: 'ai_insights', type: 'text' })
  aiInsights: string;

  @Column({ name: 'ai_recommendations', type: 'text' })
  aiRecommendations: string;

  @Column({ name: 'ai_confidence', type: 'float' })
  aiConfidence: number;

  // Raw Data
  @Column({ name: 'raw_content', type: 'text' })
  rawContent: string;

  // Status
  @Column({ name: 'status', length: 50, default: 'completed' })
  status: string; // pending, completed, failed

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}