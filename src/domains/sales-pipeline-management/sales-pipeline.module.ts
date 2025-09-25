import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineController } from './deal-lifecycle/infrastructure/controllers/pipeline.controller';
import { SalesPipelineService } from './sales-pipeline.service';

@Module({
  imports: [
    // TypeORM entities будут добавлены позже
    TypeOrmModule.forFeature([])
  ],
  controllers: [PipelineController],
  providers: [SalesPipelineService],
  exports: [SalesPipelineService]
})
export class SalesPipelineModule {}