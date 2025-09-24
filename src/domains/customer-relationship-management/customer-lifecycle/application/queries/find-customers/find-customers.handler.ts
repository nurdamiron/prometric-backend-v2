import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryHandler, QueryResult } from '../../../../../../shared/application/interfaces/query-handler.interface';
import { FindCustomersQuery } from './find-customers.query';
import { CustomerPersistenceEntity } from '../../../infrastructure/persistence/customer.persistence.entity';

export interface CustomerListItem {
  id: string;
  fullName: string;
  email: string;
  companyName?: string;
  status: string;
  leadScore: number;
  totalValue: number;
  potentialValue: number;
  assignedTo?: string;
  lastContactDate?: Date;
  isOverdue: boolean;
  createdAt: Date;
}

export interface FindCustomersResult {
  customers: CustomerListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    organizationId: string;
    search?: string;
    status?: string[];
    assignedTo?: string;
  };
}

@Injectable()
export class FindCustomersHandler implements QueryHandler<FindCustomersQuery, FindCustomersResult> {
  constructor(
    @InjectRepository(CustomerPersistenceEntity)
    private readonly customerRepository: Repository<CustomerPersistenceEntity>
  ) {}

  async execute(query: FindCustomersQuery): Promise<QueryResult<FindCustomersResult>> {
    try {
      const queryBuilder = this.customerRepository.createQueryBuilder('customer');

      // Organization filter (always required)
      queryBuilder.where('customer.organizationId = :organizationId', {
        organizationId: query.organizationId
      });

      // Search filter
      if (query.search) {
        queryBuilder.andWhere(`(
          customer.firstName ILIKE :search OR
          customer.lastName ILIKE :search OR
          customer.email ILIKE :search OR
          customer.companyName ILIKE :search
        )`, { search: `%${query.search}%` });
      }

      // Status filter
      if (query.status && query.status.length > 0) {
        queryBuilder.andWhere('customer.status IN (:...statuses)', { statuses: query.status });
      }

      // Assigned to filter
      if (query.assignedTo) {
        if (query.assignedTo === 'unassigned') {
          queryBuilder.andWhere('customer.assignedTo IS NULL');
        } else {
          queryBuilder.andWhere('customer.assignedTo = :assignedTo', { assignedTo: query.assignedTo });
        }
      }

      // Tags filter
      if (query.tags && query.tags.length > 0) {
        queryBuilder.andWhere('customer.tags && :tags', { tags: query.tags });
      }

      // Date range filters
      if (query.createdAfter) {
        queryBuilder.andWhere('customer.createdAt >= :createdAfter', { createdAfter: query.createdAfter });
      }

      if (query.createdBefore) {
        queryBuilder.andWhere('customer.createdAt <= :createdBefore', { createdBefore: query.createdBefore });
      }

      // Lead score range
      if (query.leadScoreMin !== undefined) {
        queryBuilder.andWhere('customer.leadScore >= :leadScoreMin', { leadScoreMin: query.leadScoreMin });
      }

      if (query.leadScoreMax !== undefined) {
        queryBuilder.andWhere('customer.leadScore <= :leadScoreMax', { leadScoreMax: query.leadScoreMax });
      }

      // Potential value range
      if (query.potentialValueMin !== undefined) {
        queryBuilder.andWhere('customer.potentialValue >= :potentialValueMin', {
          potentialValueMin: query.potentialValueMin
        });
      }

      // Overdue follow-up filter
      if (query.overdueOnly) {
        queryBuilder.andWhere('customer.nextFollowUpDate < NOW()')
          .andWhere('customer.nextFollowUpDate IS NOT NULL');
      }

      // Count total
      const total = await queryBuilder.getCount();

      // Apply pagination
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;

      queryBuilder.skip(offset).take(limit);

      // Apply sorting
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'DESC';
      queryBuilder.orderBy(`customer.${sortBy}`, sortOrder);

      // Execute query
      const entities = await queryBuilder.getMany();

      // Transform to read models
      const customers = entities.map(entity => this.toListItem(entity));

      const result: FindCustomersResult = {
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        filters: {
          organizationId: query.organizationId,
          search: query.search,
          status: query.status,
          assignedTo: query.assignedTo
        }
      };

      return {
        success: true,
        data: result,
        metadata: {
          total,
          page,
          limit,
          queryTime: Date.now() - (query.timestamp?.getTime() || Date.now())
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to find customers'
      };
    }
  }

  private toListItem(entity: CustomerPersistenceEntity): CustomerListItem {
    const fullName = `${entity.firstName} ${entity.lastName}`.trim();
    const isOverdue = entity.nextFollowUpDate ?
      new Date(entity.nextFollowUpDate) < new Date() : false;

    return {
      id: entity.id,
      fullName,
      email: entity.email,
      companyName: entity.companyName,
      status: entity.status,
      leadScore: entity.leadScore,
      totalValue: entity.totalValue,
      potentialValue: entity.potentialValue,
      assignedTo: entity.assignedTo,
      lastContactDate: entity.lastContactDate,
      isOverdue,
      createdAt: entity.createdAt
    };
  }
}