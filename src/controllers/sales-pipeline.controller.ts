import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsBoolean, IsOptional, IsUUID, MaxLength } from 'class-validator';
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

export class CreatePipelineDto {
  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

@ApiTags('sales-pipelines')
@Controller('sales-pipelines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SalesPipelineController {
  constructor(private readonly salesPipelineService: SalesPipelineService) {}

  @Get()
  @ApiOperation({ summary: 'Get all sales pipelines for organization' })
  @ApiResponse({ status: 200, description: 'Sales pipelines retrieved successfully' })
  async getPipelines(@Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    return this.salesPipelineService.pipelines(organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new sales pipeline' })
  @ApiResponse({ status: 201, description: 'Sales pipeline created successfully' })
  async createPipeline(@Body() dto: CreatePipelineDto, @Req() req: any) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    return this.salesPipelineService.createPipeline(organizationId, {
      name: dto.name,
      description: dto.description,
      isDefault: dto.isDefault
    }, userId);
  }

  @Get(':pipelineId/stages')
  @ApiOperation({ summary: 'Get stages for sales pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline stages retrieved successfully' })
  async getPipelineStages(@Param('pipelineId') pipelineId: string, @Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    return this.salesPipelineService.stages(pipelineId, organizationId);
  }
}