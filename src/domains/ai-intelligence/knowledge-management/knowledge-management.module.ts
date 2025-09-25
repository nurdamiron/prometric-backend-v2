import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { KnowledgeDocumentEntity, DocumentChunkEntity } from './infrastructure/persistence/knowledge-document.entity';
import { KnowledgeManagementController } from './infrastructure/controllers/knowledge-management.controller';
import { WebsiteScrapingService } from './infrastructure/external-services/website-scraping.service';
import { EmbeddingService } from './infrastructure/external-services/embedding.service';
import { RAGService } from './application/rag.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeDocumentEntity, DocumentChunkEntity]),
    ConfigModule
  ],
  controllers: [KnowledgeManagementController],
  providers: [
    WebsiteScrapingService,
    EmbeddingService,
    RAGService
  ],
  exports: [
    WebsiteScrapingService,
    EmbeddingService,
    RAGService,
    TypeOrmModule
  ]
})
export class KnowledgeManagementModule {}