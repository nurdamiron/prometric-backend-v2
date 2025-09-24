import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../../auth/guards/jwt-auth.guard';
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
}