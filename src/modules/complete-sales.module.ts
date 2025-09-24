import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesPipeline, SalesStage, SalesDeal } from '../entities/sales-pipeline.entity';
import { Organization } from '../auth/entities/user.entity';
import { SalesPipelineService } from '../services/sales-pipeline.service';
import { SalesPipelineController } from '../controllers/sales-pipeline.controller';
import { DealsController } from '../controllers/deals.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesPipeline,
      SalesStage,
      SalesDeal,
      Organization
    ])
  ],
  providers: [SalesPipelineService],
  controllers: [SalesPipelineController, DealsController],
  exports: [SalesPipelineService, TypeOrmModule]
})
export class CompleteSalesModule {}