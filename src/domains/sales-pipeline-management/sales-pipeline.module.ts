import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineController } from './deal-lifecycle/infrastructure/controllers/pipeline.controller';
import { DealController } from './deal-lifecycle/infrastructure/controllers/deal.controller';
import { SalesPipelineService } from './sales-pipeline.service';
import { 
  PipelinePersistenceEntity, 
  DealPersistenceEntity, 
  DealActivityEntity 
} from './deal-lifecycle/infrastructure/persistence/pipeline.persistence.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PipelinePersistenceEntity,
      DealPersistenceEntity,
      DealActivityEntity
    ])
  ],
  controllers: [
    PipelineController,
    DealController
  ],
  providers: [SalesPipelineService],
  exports: [SalesPipelineService]
})
export class SalesPipelineModule {}