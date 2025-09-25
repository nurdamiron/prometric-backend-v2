import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('knowledge_documents')
@Index(['organizationId'])
@Index(['source'])
@Index(['accessLevel'])
@Index(['language'])
@Index(['createdBy'])
export class KnowledgeDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: ['website', 'instagram', 'manual', 'upload'],
    default: 'manual'
  })
  source: 'website' | 'instagram' | 'manual' | 'upload';

  @Column({ name: 'source_url', length: 1000, nullable: true })
  sourceUrl?: string;

  @Column({
    name: 'access_level',
    type: 'enum',
    enum: ['public', 'confidential', 'restricted'],
    default: 'public'
  })
  accessLevel: 'public' | 'confidential' | 'restricted';

  @Column({
    type: 'enum',
    enum: ['ru', 'kz', 'en'],
    default: 'ru'
  })
  language: 'ru' | 'kz' | 'en';

  @Column({ name: 'word_count', default: 0 })
  wordCount: number;

  @Column({ name: 'chunk_count', default: 0 })
  chunkCount: number;

  // pgvector embedding column (1536 dimensions for text-embedding-ada-002)
  @Column({
    type: 'vector',
    length: 1536,
    nullable: true
  })
  embedding?: number[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    sourceData?: any;
    keywords?: string[];
    headings?: string[];
    extractedAt?: Date;
    scrapedFrom?: string;
    fileSize?: number;
    processingNotes?: string;
  };

  @Column({ name: 'created_by' })
  createdBy: string;

  // Vector embeddings for RAG
  @Column({ type: 'vector', name: 'content_embedding', nullable: true })
  contentEmbedding?: number[];

  @Column({ name: 'embedding_model', length: 50, nullable: true, default: 'gemini-embedding-001' })
  embeddingModel?: string;

  @Column({ name: 'embedding_created_at', type: 'timestamp', nullable: true })
  embeddingCreatedAt?: Date;

  @Column({ name: 'embedding_tokens', type: 'integer', nullable: true })
  embeddingTokens?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft delete support
  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}

@Entity('document_chunks')
@Index(['documentId'])
@Index(['organizationId'])
@Index(['chunkIndex'])
export class DocumentChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'chunk_index' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  // pgvector embedding for semantic search
  @Column({ type: 'vector', name: 'chunk_embedding', nullable: true })
  chunkEmbedding?: number[];

  @Column({ name: 'embedding_model', length: 50, nullable: true, default: 'gemini-embedding-001' })
  embeddingModel?: string;

  @Column({ name: 'embedding_created_at', type: 'timestamp', nullable: true })
  embeddingCreatedAt?: Date;

  @Column({ name: 'embedding_tokens', type: 'integer', nullable: true })
  embeddingTokens?: number;

  @Column({ name: 'token_count', default: 0 })
  tokenCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}