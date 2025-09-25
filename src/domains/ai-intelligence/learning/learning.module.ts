import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { LearningService } from './application/learning.service';
import { LearningEventEntity } from './infrastructure/persistence/learning.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningEventEntity]),
    ScheduleModule.forRoot() // Enable cron jobs
  ],
  providers: [LearningService],
  exports: [LearningService, TypeOrmModule]
})
export class LearningModule {}