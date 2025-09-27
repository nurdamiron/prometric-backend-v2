import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { KnowledgeDocumentEntity, DocumentChunkEntity } from './infrastructure/persistence/knowledge-document.entity';
import { BusinessAnalysisEntity } from './infrastructure/persistence/business-analysis.entity';
import { KnowledgeManagementController } from './infrastructure/controllers/knowledge-management.controller';
import { WebsiteScrapingService } from './infrastructure/external-services/website-scraping.service';
import { EmbeddingService } from './infrastructure/external-services/embedding.service';
import { RAGService } from './application/rag.service';
import { VertexAIService } from '../../../shared/services/vertex-ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeDocumentEntity, DocumentChunkEntity]), // Temporarily removed BusinessAnalysisEntity
    ConfigModule,
    // OrchestrationModule // For VertexAIService - removed to avoid circular dependency
  ],
  controllers: [KnowledgeManagementController],
  providers: [
    WebsiteScrapingService,
    EmbeddingService,
    RAGService,
    VertexAIService
  ],
  exports: [
    WebsiteScrapingService,
    EmbeddingService,
    RAGService,
    TypeOrmModule
  ]
})
export class KnowledgeManagementModule {}