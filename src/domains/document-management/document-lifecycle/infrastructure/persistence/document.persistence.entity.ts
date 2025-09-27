import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';

/**
 * DOCUMENT PERSISTENCE ENTITY
 * Represents documents in the system with full metadata and versioning
 */
@Entity('documents')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
@Index(['organizationId', 'documentType'])
@Index(['organizationId', 'assignedTo'])
@Index(['organizationId', 'customerId'])
export class DocumentPersistenceEntity {
  @PrimaryColumn('uuid')
  id: string;

  // Organization relationship
  @Column({ name: 'organization_id' })
  organizationId: string;

  // Document Information
  @Column({ name: 'title', length: 255 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'document_type', length: 50 })
  documentType: string; // contract, invoice, proposal, report, etc.

  @Column({ name: 'category', length: 100, nullable: true })
  category?: string;

  // File Information
  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ name: 'file_path', length: 500 })
  filePath: string;

  @Column({ name: 's3_key', length: 1000, nullable: true })
  s3Key?: string;

  @Column({ name: 's3_url', length: 1000, nullable: true })
  s3Url?: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ name: 'file_hash', length: 64, nullable: true })
  fileHash?: string; // SHA-256 hash for integrity

  // Versioning
  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'is_latest_version', type: 'boolean', default: true })
  isLatestVersion: boolean;

  @Column({ name: 'parent_document_id', nullable: true })
  parentDocumentId?: string; // For versioning

  // Status and Workflow
  @Column({ name: 'status', length: 50, default: 'draft' })
  status: string; // draft, review, approved, rejected, archived

  @Column({ name: 'priority', length: 20, default: 'normal' })
  priority: string; // low, normal, high, urgent

  // Relationships
  @Column({ name: 'customer_id', nullable: true })
  customerId?: string; // Related customer

  @Column({ name: 'deal_id', nullable: true })
  dealId?: string; // Related deal/opportunity

  // Assignment and Ownership
  @Column({ name: 'created_by' })
  createdBy: string; // User ID who created

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo?: string; // User ID assigned to

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy?: string; // User ID who reviewed

  @Column({ name: 'approved_by', nullable: true })
  approvedBy?: string; // User ID who approved

  // Dates
  @Column({ name: 'due_date', nullable: true })
  dueDate?: Date;

  @Column({ name: 'reviewed_at', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'archived_at', nullable: true })
  archivedAt?: Date;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ name: 'custom_fields', type: 'jsonb', nullable: true })
  customFields?: Record<string, any>;

  @Column({ name: 'access_level', length: 20, default: 'organization' })
  accessLevel: string; // public, organization, team, private

  // Collaboration
  @Column({ name: 'collaborators', type: 'jsonb', nullable: true })
  collaborators?: string[]; // Array of user IDs

  @Column({ name: 'comments_count', type: 'int', default: 0 })
  commentsCount: number;

  @Column({ name: 'downloads_count', type: 'int', default: 0 })
  downloadsCount: number;

  @Column({ name: 'views_count', type: 'int', default: 0 })
  viewsCount: number;

  // Audit fields
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete
  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

/**
 * DOCUMENT COMMENT ENTITY
 * For document collaboration and comments
 */
@Entity('document_comments')
@Index(['documentId', 'createdAt'])
export class DocumentCommentEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'comment', type: 'text' })
  comment: string;

  @Column({ name: 'parent_comment_id', nullable: true })
  parentCommentId?: string; // For threaded comments

  @Column({ name: 'is_resolved', type: 'boolean', default: false })
  isResolved: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/**
 * DOCUMENT ACCESS LOG ENTITY
 * For tracking document access and downloads
 */
@Entity('document_access_logs')
@Index(['documentId', 'userId', 'createdAt'])
export class DocumentAccessLogEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'action', length: 50 })
  action: string; // view, download, edit, comment, share

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}