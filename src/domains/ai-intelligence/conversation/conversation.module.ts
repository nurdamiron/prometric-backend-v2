import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConversationService } from './application/conversation.service';
import {
  ConversationSessionEntity,
  ConversationMessageEntity
} from './infrastructure/persistence/conversation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationSessionEntity,
      ConversationMessageEntity
    ])
  ],
  providers: [ConversationService],
  exports: [ConversationService, TypeOrmModule]
})
export class ConversationModule {}