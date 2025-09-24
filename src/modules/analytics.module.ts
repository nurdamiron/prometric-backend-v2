import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Organization } from '../auth/entities/user.entity';
import { SalesPipeline, SalesStage, SalesDeal } from '../entities/sales-pipeline.entity';
import { CustomerPersistenceEntity } from '../domains/customer-relationship-management/customer-lifecycle/infrastructure/persistence/customer.persistence.entity';
import { AnalyticsController } from '../controllers/analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Organization,
      SalesPipeline,
      SalesStage,
      SalesDeal,
      CustomerPersistenceEntity
    ])
  ],
  controllers: [AnalyticsController],
  exports: [TypeOrmModule]
})
export class AnalyticsModule {}