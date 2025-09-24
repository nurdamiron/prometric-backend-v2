import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandHandler, CommandResult } from '../../../../../../shared/application/interfaces/command-handler.interface';
import { Customer } from '../../../domain/entities/customer.aggregate';
import { CustomerInfo } from '../../../domain/value-objects/customer-info.vo';
import { CreateCustomerCommand } from './create-customer.command';
import { CustomerPersistenceEntity } from '../../../infrastructure/persistence/customer.persistence.entity';

@Injectable()
export class CreateCustomerHandler implements CommandHandler<CreateCustomerCommand, string> {
  constructor(
    @InjectRepository(CustomerPersistenceEntity)
    private readonly customerRepository: Repository<CustomerPersistenceEntity>
  ) {}

  async execute(command: CreateCustomerCommand): Promise<CommandResult<string>> {
    try {
      // Create customer info value object
      const customerInfo = new CustomerInfo({
        firstName: command.firstName,
        lastName: command.lastName,
        email: command.email,
        phone: command.phone,
        companyName: command.companyName
      });

      // Create customer aggregate
      const customer = Customer.create(
        command.organizationId,
        customerInfo,
        command.createdBy
      );

      // Set optional fields
      if (command.assignedTo) {
        customer.assignTo(command.assignedTo);
      }

      if (command.notes) {
        customer.addNotes(command.notes);
      }

      if (command.tags && command.tags.length > 0) {
        command.tags.forEach(tag => customer.addTag(tag));
      }

      if (command.potentialValue && command.potentialValue > 0) {
        customer.updatePotentialValue(command.potentialValue);
      }

      // Check if customer already exists
      const existingCustomer = await this.customerRepository.findOne({
        where: { email: command.email, organizationId: command.organizationId }
      });

      if (existingCustomer) {
        return {
          success: false,
          error: 'Customer with this email already exists in organization'
        };
      }

      // Save customer (simplified approach for now)
      const customerEntity = this.customerRepository.create({
        id: customer.getCustomerId().value,
        organizationId: command.organizationId,
        firstName: command.firstName,
        lastName: command.lastName,
        email: command.email,
        phone: command.phone,
        companyName: command.companyName,
        status: customer.getStatus().value,
        leadScore: customer.getLeadScore(),
        totalValue: customer.getTotalValue(),
        potentialValue: customer.getPotentialValue(),
        assignedTo: command.assignedTo,
        notes: command.notes,
        tags: command.tags,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await this.customerRepository.save(customerEntity);

      return {
        success: true,
        data: customer.getCustomerId().value,
        metadata: {
          customerInfo: customer.getCustomerInfo().value,
          status: customer.getStatus().value,
          leadScore: customer.getLeadScore()
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create customer'
      };
    }
  }
}