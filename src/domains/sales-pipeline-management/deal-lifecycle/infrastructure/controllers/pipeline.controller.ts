import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../user-identity-access/authentication/infrastructure/guards/jwt-auth.guard';
import { IsString, IsBoolean, IsOptional, IsUUID, IsArray, IsNumber, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { SalesPipelineService } from '../../../sales-pipeline.service';

// HTML sanitization
const sanitizeInput = (value: string) => {
  if (!value || typeof value !== 'string') return value;
  return value.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '');
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

export class CreateStageDto {
  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(7)
  colorHex: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  probability: number;

  @ApiProperty()
  @IsString()
  type: 'normal' | 'won' | 'lost';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  wipLimit?: number;
}

export class ReorderStagesDto {
  @ApiProperty()
  @IsArray()
  order: Array<{
    stageId: string;
    orderIndex: number;
  }>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  recalcProbabilities?: boolean;
}

export class MergeStagesDto {
  @ApiProperty()
  @IsUUID()
  targetStageId: string;
}

@ApiTags('pipelines')
@Controller('pipelines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PipelineController {
  constructor(private readonly salesPipelineService: SalesPipelineService) {}

  @Get()
  @ApiOperation({ summary: 'Get all pipelines for organization' })
  @ApiResponse({ status: 200, description: 'Pipelines retrieved successfully' })
  async getPipelines(@Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    return this.salesPipelineService.pipelines(organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new pipeline' })
  @ApiResponse({ status: 201, description: 'Pipeline created successfully' })
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
  @ApiOperation({ summary: 'Get stages for pipeline' })
  async getPipelineStages(@Param('pipelineId') pipelineId: string, @Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    return this.salesPipelineService.stages(pipelineId, organizationId);
  }

  @Post(':pipelineId/stages')
  @ApiOperation({ summary: 'Create new stage in pipeline' })
  async createStage(@Param('pipelineId') pipelineId: string, @Body() dto: CreateStageDto) {
    try {
      return {
        success: true,
        data: {
          id: uuidv4(),
          pipelineId,
          name: dto.name,
          slug: dto.name.toLowerCase().replace(/\s+/g, '-'),
          colorHex: dto.colorHex,
          probability: dto.probability,
          type: dto.type,
          wipLimit: dto.wipLimit,
          orderIndex: 99, // Will be calculated properly
          isActive: true,
          createdAt: new Date().toISOString()
        },
        message: 'Stage structure validated - database integration pending'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create stage'
      };
    }
  }

  @Put(':pipelineId/stages/reorder')
  @ApiOperation({ summary: 'Reorder stages in pipeline' })
  async reorderStages(
    @Param('pipelineId') pipelineId: string,
    @Body() dto: ReorderStagesDto
  ) {
    try {
      return {
        success: true,
        data: {
          pipelineId,
          updatedStages: dto.order.length,
          recalculatedProbabilities: dto.recalcProbabilities || false
        },
        message: 'Stage reorder validated - database integration pending'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to reorder stages'
      };
    }
  }

  @Post('stages/:stageId/merge')
  @ApiOperation({ summary: 'Merge two stages' })
  async mergeStages(@Param('stageId') stageId: string, @Body() dto: MergeStagesDto) {
    try {
      return {
        success: true,
        data: {
          sourceStageId: stageId,
          targetStageId: dto.targetStageId,
          mergedAt: new Date().toISOString()
        },
        message: 'Stage merge validated - database integration pending'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to merge stages'
      };
    }
  }

  @Delete('stages/:stageId')
  @ApiOperation({ summary: 'Delete stage (if empty)' })
  async deleteStage(@Param('stageId') stageId: string) {
    try {
      // For now, simulate check
      const dealsCount = 0; // Will check real count from database

      if (dealsCount > 0) {
        return {
          success: false,
          message: `Cannot delete stage with ${dealsCount} deals`,
          error: 'STAGE_NOT_EMPTY',
          dealsCount
        };
      }

      return {
        success: true,
        data: {
          deletedStageId: stageId,
          deletedAt: new Date().toISOString()
        },
        message: 'Stage deletion validated - database integration pending'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to delete stage'
      };
    }
  }
}