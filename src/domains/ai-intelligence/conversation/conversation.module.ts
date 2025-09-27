import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConversationService } from './application/conversation.service';
import { ConversationController } from './infrastructure/controllers/conversation.controller';
import {
  ConversationSessionEntity,
  ConversationMessageEntity
} from './infrastructure/persistence/conversation.entity';

// Import orchestration module for AI processing
import { OrchestrationModule } from '../orchestration/orchestration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationSessionEntity,
      ConversationMessageEntity
    ]),
    forwardRef(() => OrchestrationModule) // Use forwardRef to avoid circular dependency
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService, TypeOrmModule]
})
export class ConversationModule {}