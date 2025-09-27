import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { AiOrchestratorController } from './infrastructure/controllers/ai-orchestrator.controller';
import { AiOrchestratorService } from './application/ai-orchestrator.service';
import { VertexAIService } from './infrastructure/external-services/vertex-ai.service';

// Import entities from auth module
import { User, Organization } from '../../user-identity-access/authentication/domain/entities/user.entity';

// Import Knowledge Management module for RAG integration
import { KnowledgeManagementModule } from '../knowledge-management/knowledge-management.module';
// Import Conversation module for context-aware chats
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization]),
    ConfigModule,
    KnowledgeManagementModule, // RAG integration
    ConversationModule // Conversation context integration
  ],
  controllers: [AiOrchestratorController],
  providers: [AiOrchestratorService, VertexAIService],
  exports: [AiOrchestratorService, VertexAIService, TypeOrmModule]
})
export class OrchestrationModule {}