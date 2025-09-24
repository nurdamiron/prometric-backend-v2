import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerPersistenceEntity } from './infrastructure/persistence/customer.persistence.entity';
import { CustomerController } from './infrastructure/controllers/customer.controller';
import { CreateCustomerHandler } from './application/commands/create-customer/create-customer.handler';
import { FindCustomersHandler } from './application/queries/find-customers/find-customers.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerPersistenceEntity])
  ],
  controllers: [
    CustomerController
  ],
  providers: [
    // Command handlers
    CreateCustomerHandler,

    // Query handlers
    FindCustomersHandler,
  ],
  exports: [
    CreateCustomerHandler,
    FindCustomersHandler
  ]
})
export class CustomerManagementModule {}