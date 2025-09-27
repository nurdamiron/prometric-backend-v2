import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../user-identity-access/authentication/infrastructure/guards/jwt-auth.guard';
import { CustomerPersistenceEntity } from '../persistence/customer.persistence.entity';
import { IsString, IsEmail, IsOptional, IsUUID, IsNumber, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

// Simple HTML tag removal
const stripHTML = (value: string) => {
  if (!value || typeof value !== 'string') return value;
  return value.replace(/<[^>]*>/g, '');
};

export class CreateCustomerDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  firstName: string;

  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  potentialValue?: number;
}

export class UpdateCustomerDto {
  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  leadScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  potentialValue?: number;

  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  customFields?: Record<string, any>;
}

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomerController {
  constructor(
    @InjectRepository(CustomerPersistenceEntity)
    private readonly customerRepository: Repository<CustomerPersistenceEntity>
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get customers list' })
  @ApiResponse({ status: 200, description: 'Customers retrieved successfully' })
  async getCustomers(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('status') status?: string
  ) {
    try {
      const organizationId = req.user.organizationId;

      const queryBuilder = this.customerRepository.createQueryBuilder('customer');

      // Organization filter
      if (organizationId) {
        queryBuilder.where('customer.organizationId = :organizationId', { organizationId });
      }

      // Search filter
      if (search) {
        queryBuilder.andWhere(`(
          customer.firstName ILIKE :search OR
          customer.lastName ILIKE :search OR
          customer.email ILIKE :search OR
          customer.companyName ILIKE :search
        )`, { search: `%${search}%` });
      }

      // Status filter
      if (status) {
        queryBuilder.andWhere('customer.status = :status', { status });
      }

      // Count total
      const total = await queryBuilder.getCount();

      // Apply pagination
      const offset = (page - 1) * limit;
      queryBuilder.skip(offset).take(limit);

      // Order by creation date
      queryBuilder.orderBy('customer.createdAt', 'DESC');

      const customers = await queryBuilder.getMany();

      return {
        success: true,
        data: {
          customers: customers.map(customer => ({
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            fullName: `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            phone: customer.phone,
            companyName: customer.companyName,
            status: customer.status,
            leadScore: customer.leadScore,
            totalValue: customer.totalValue,
            potentialValue: customer.potentialValue,
            createdAt: customer.createdAt
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch customers'
      };
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  async createCustomer(@Body() dto: CreateCustomerDto, @Req() req: any) {
    try {
      // Check if customer already exists
      const existingCustomer = await this.customerRepository.findOne({
        where: { email: dto.email, organizationId: dto.organizationId }
      });

      if (existingCustomer) {
        return {
          success: false,
          message: 'Customer with this email already exists'
        };
      }

      // Create customer
      const customer = this.customerRepository.create({
        id: require('uuid').v4(),
        organizationId: dto.organizationId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        companyName: dto.companyName,
        status: 'lead',
        leadScore: 0,
        totalValue: 0,
        potentialValue: dto.potentialValue || 0,
        notes: dto.notes,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedCustomer = await this.customerRepository.save(customer);

      return {
        success: true,
        data: {
          id: savedCustomer.id,
          firstName: savedCustomer.firstName,
          lastName: savedCustomer.lastName,
          email: savedCustomer.email,
          status: savedCustomer.status,
          createdAt: savedCustomer.createdAt
        },
        message: 'Customer created successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create customer'
      };
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  async getCustomer(@Param('id') id: string, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      const customer = await this.customerRepository.findOne({
        where: { id, ...(organizationId && { organizationId }) }
      });

      if (!customer) {
        return {
          success: false,
          message: 'Customer not found'
        };
      }

      return {
        success: true,
        data: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          fullName: `${customer.firstName} ${customer.lastName}`,
          email: customer.email,
          phone: customer.phone,
          companyName: customer.companyName,
          status: customer.status,
          leadScore: customer.leadScore,
          totalValue: customer.totalValue,
          potentialValue: customer.potentialValue,
          notes: customer.notes,
          tags: customer.tags,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch customer'
      };
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer by ID' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  async updateCustomer(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: any
  ) {
    try {
      const organizationId = req.user.organizationId;

      // Find customer
      const customer = await this.customerRepository.findOne({
        where: { id, ...(organizationId && { organizationId }) }
      });

      if (!customer) {
        return {
          success: false,
          message: 'Customer not found'
        };
      }

      // Check email uniqueness if email is being updated
      if (dto.email && dto.email !== customer.email) {
        const existingCustomer = await this.customerRepository.findOne({
          where: { email: dto.email, organizationId }
        });

        if (existingCustomer) {
          return {
            success: false,
            message: 'Customer with this email already exists'
          };
        }
      }

      // Update customer
      const updatedCustomer = await this.customerRepository.save({
        ...customer,
        ...dto,
        updatedAt: new Date()
      });

      return {
        success: true,
        data: {
          id: updatedCustomer.id,
          firstName: updatedCustomer.firstName,
          lastName: updatedCustomer.lastName,
          email: updatedCustomer.email,
          status: updatedCustomer.status,
          updatedAt: updatedCustomer.updatedAt
        },
        message: 'Customer updated successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to update customer'
      };
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete customer by ID (soft delete)' })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully' })
  async deleteCustomer(@Param('id') id: string, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      // Find customer
      const customer = await this.customerRepository.findOne({
        where: { id, ...(organizationId && { organizationId }) }
      });

      if (!customer) {
        return {
          success: false,
          message: 'Customer not found'
        };
      }

      // Soft delete
      await this.customerRepository.save({
        ...customer,
        deletedAt: new Date(),
        updatedAt: new Date()
      });

      return {
        success: true,
        message: 'Customer deleted successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to delete customer'
      };
    }
  }

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Get customer statistics summary' })
  @ApiResponse({ status: 200, description: 'Customer statistics retrieved successfully' })
  async getCustomerStats(@Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      if (!organizationId) {
        return {
          success: false,
          message: 'Organization ID is required'
        };
      }

      // Get total customers
      const totalCustomers = await this.customerRepository.count({
        where: { organizationId, deletedAt: undefined }
      });

      // Get customers by status
      const customersByStatus = await this.customerRepository
        .createQueryBuilder('customer')
        .select('customer.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('customer.organizationId = :organizationId', { organizationId })
        .andWhere('customer.deletedAt IS NULL')
        .groupBy('customer.status')
        .getRawMany();

      // Get total potential value
      const totalPotentialValue = await this.customerRepository
        .createQueryBuilder('customer')
        .select('SUM(customer.potentialValue)', 'total')
        .where('customer.organizationId = :organizationId', { organizationId })
        .andWhere('customer.deletedAt IS NULL')
        .getRawOne();

      // Get recent customers (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentCustomers = await this.customerRepository
        .createQueryBuilder('customer')
        .where('customer.organizationId = :organizationId', { organizationId })
        .andWhere('customer.deletedAt IS NULL')
        .andWhere('customer.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount();

      return {
        success: true,
        data: {
          totalCustomers,
          customersByStatus: customersByStatus.reduce((acc, item) => {
            acc[item.status] = parseInt(item.count);
            return acc;
          }, {}),
          totalPotentialValue: parseFloat(totalPotentialValue.total) || 0,
          recentCustomers
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch customer statistics'
      };
    }
  }
}