import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsNumber, IsOptional, IsUUID, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { SalesPipelineService } from '../services/sales-pipeline.service';

// Enhanced sanitization
const sanitizeInput = (value: string) => {
  if (!value || typeof value !== 'string') return value;
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/(javascript|data|vbscript|blob|file):/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/\b(alert|confirm|prompt|eval|setTimeout|setInterval|Function|console\.log|console\.error|document\.|window\.|location\.|history\.)\s*\([^)]*\)/gi, '')
    .replace(/[;&|]+/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export class CreateDealDto {
  @ApiProperty()
  @IsUUID()
  pipelineId: string;

  @ApiProperty()
  @IsUUID()
  customerId: string;

  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  dealName: string;

  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(999999999999.99)
  amount: number;

  @ApiPropertyOptional({ default: 'KZT' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiProperty()
  @IsUUID()
  ownerId: string;
}

export class MoveDealDto {
  @ApiProperty()
  @IsUUID()
  stageId: string;

  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@ApiTags('deals')
@Controller('deals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DealsController {
  constructor(private readonly salesPipelineService: SalesPipelineService) {}

  @Get()
  @ApiOperation({ summary: 'Get deals for organization' })
  @ApiResponse({ status: 200, description: 'Deals retrieved successfully' })
  async getDeals(
    @Req() req: any,
    @Query('pipelineId') pipelineId?: string,
    @Query('stageId') stageId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20
  ) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    return this.salesPipelineService.deals(organizationId, pipelineId, stageId, page, limit);
  }

  @Post()
  @ApiOperation({ summary: 'Create new deal' })
  @ApiResponse({ status: 201, description: 'Deal created successfully' })
  async createDeal(@Body() dto: CreateDealDto, @Req() req: any) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    return this.salesPipelineService.createDeal(organizationId, {
      pipelineId: dto.pipelineId,
      customerId: dto.customerId,
      dealName: dto.dealName,
      description: dto.description,
      amount: dto.amount,
      currency: dto.currency,
      expectedCloseDate: dto.expectedCloseDate,
      ownerId: dto.ownerId
    }, userId);
  }

  @Put(':dealId/move')
  @ApiOperation({ summary: 'Move deal to different stage' })
  @ApiResponse({ status: 200, description: 'Deal moved successfully' })
  async moveDeal(
    @Param('dealId') dealId: string,
    @Body() dto: MoveDealDto,
    @Req() req: any
  ) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    return this.salesPipelineService.moveDeal(dealId, dto.stageId, organizationId, userId);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get sales analytics for organization' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getAnalytics(@Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      // Get total deals
      const totalDeals = await this.salesPipelineService.deals(organizationId);
      const deals = totalDeals.data.deals;

      // Calculate analytics
      const analytics = {
        overview: {
          totalDeals: deals.length,
          activeDeals: deals.filter(d => d.status === 'active').length,
          wonDeals: deals.filter(d => d.status === 'won').length,
          lostDeals: deals.filter(d => d.status === 'lost').length
        },
        revenue: {
          totalValue: deals.reduce((sum, d) => sum + d.amount, 0),
          wonValue: deals.filter(d => d.status === 'won').reduce((sum, d) => sum + d.amount, 0),
          weightedValue: deals.reduce((sum, d) => sum + d.weightedValue, 0),
          averageDealSize: deals.length > 0 ? deals.reduce((sum, d) => sum + d.amount, 0) / deals.length : 0
        },
        pipeline: {
          conversionRate: deals.length > 0 ? (deals.filter(d => d.status === 'won').length / deals.length) * 100 : 0,
          averageProbability: deals.filter(d => d.status === 'active').length > 0
            ? deals.filter(d => d.status === 'active').reduce((sum, d) => sum + d.probability, 0) / deals.filter(d => d.status === 'active').length
            : 0,
          overdueDeals: deals.filter(d => d.isOverdue).length
        },
        timeMetrics: {
          averageAgeInDays: deals.length > 0 ? deals.reduce((sum, d) => sum + d.ageInDays, 0) / deals.length : 0,
          averageDaysToClose: deals.filter(d => d.status === 'won').length > 0
            ? deals.filter(d => d.status === 'won').reduce((sum, d) => sum + d.ageInDays, 0) / deals.filter(d => d.status === 'won').length
            : 0
        }
      };

      return {
        success: true,
        data: analytics,
        message: 'Sales analytics calculated successfully'
      };
    } catch (error) {
      throw new BadRequestException('Failed to generate analytics');
    }
  }
}