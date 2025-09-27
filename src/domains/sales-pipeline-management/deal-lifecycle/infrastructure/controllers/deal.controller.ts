import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req, 
  UnauthorizedException,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { JwtAuthGuard } from '../../../../user-identity-access/authentication/infrastructure/guards/jwt-auth.guard';
import { v4 as uuidv4 } from 'uuid';

import { 
  PipelinePersistenceEntity, 
  DealPersistenceEntity, 
  DealActivityEntity 
} from '../persistence/pipeline.persistence.entity';
import { 
  CreateDealDto, 
  UpdateDealDto, 
  MoveDealDto, 
  CreateActivityDto, 
  UpdateActivityDto, 
  DealSearchDto,
  DealStatus 
} from '../dto/pipeline.dto';

@ApiTags('deals')
@Controller('deals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DealController {
  constructor(
    @InjectRepository(PipelinePersistenceEntity)
    private pipelineRepository: Repository<PipelinePersistenceEntity>,
    
    @InjectRepository(DealPersistenceEntity)
    private dealRepository: Repository<DealPersistenceEntity>,
    
    @InjectRepository(DealActivityEntity)
    private activityRepository: Repository<DealActivityEntity>
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get deals with search and pagination' })
  @ApiResponse({ status: 200, description: 'Deals retrieved successfully' })
  async getDeals(@Query() searchDto: DealSearchDto, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      if (!organizationId) {
        throw new UnauthorizedException('User must belong to an organization');
      }

      const queryBuilder = this.dealRepository
        .createQueryBuilder('deal')
        .leftJoinAndSelect('deal.activities', 'activities')
        .where('deal.organizationId = :organizationId', { organizationId })
        .andWhere('deal.deletedAt IS NULL');

      // Apply search filters
      if (searchDto.search) {
        queryBuilder.andWhere(
          '(deal.title ILIKE :search OR deal.description ILIKE :search)',
          { search: `%${searchDto.search}%` }
        );
      }

      if (searchDto.pipelineId) {
        queryBuilder.andWhere('deal.pipelineId = :pipelineId', { pipelineId: searchDto.pipelineId });
      }

      if (searchDto.stageId) {
        queryBuilder.andWhere('deal.stageId = :stageId', { stageId: searchDto.stageId });
      }

      if (searchDto.status) {
        queryBuilder.andWhere('deal.status = :status', { status: searchDto.status });
      }

      if (searchDto.ownerId) {
        queryBuilder.andWhere('deal.ownerId = :ownerId', { ownerId: searchDto.ownerId });
      }

      if (searchDto.assignedTo) {
        queryBuilder.andWhere('deal.assignedTo = :assignedTo', { assignedTo: searchDto.assignedTo });
      }

      if (searchDto.customerId) {
        queryBuilder.andWhere('deal.customerId = :customerId', { customerId: searchDto.customerId });
      }

      // Count total
      const total = await queryBuilder.getCount();

      // Apply pagination
      const page = searchDto.page || 1;
      const limit = searchDto.limit || 20;
      const offset = (page - 1) * limit;
      queryBuilder.skip(offset).take(limit);

      // Apply sorting
      const sortBy = searchDto.sortBy || 'createdAt';
      const sortOrder = searchDto.sortOrder || 'DESC';
      queryBuilder.orderBy(`deal.${sortBy}`, sortOrder);

      const deals = await queryBuilder.getMany();

      return {
        success: true,
        data: {
          deals: deals.map(deal => ({
            id: deal.id,
            title: deal.title,
            description: deal.description,
            value: deal.value,
            currency: deal.currency,
            probability: deal.probability,
            status: deal.status,
            source: deal.source,
            tags: deal.tags,
            customFields: deal.customFields,
            customerId: deal.customerId,
            contactId: deal.contactId,
            ownerId: deal.ownerId,
            assignedTo: deal.assignedTo,
            pipelineId: deal.pipelineId,
            stageId: deal.stageId,
            expectedCloseDate: deal.expectedCloseDate,
            actualCloseDate: deal.actualCloseDate,
            lastActivityAt: deal.lastActivityAt,
            activitiesCount: deal.activitiesCount,
            createdAt: deal.createdAt,
            updatedAt: deal.updatedAt
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
        message: error.message || 'Failed to fetch deals'
      };
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new deal' })
  @ApiResponse({ status: 201, description: 'Deal created successfully' })
  async createDeal(@Body() createDealDto: CreateDealDto, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      if (!organizationId) {
        throw new UnauthorizedException('User must belong to an organization');
      }

      // Get default pipeline for organization
      const defaultPipeline = await this.pipelineRepository.findOne({
        where: { organizationId, isDefault: true, deletedAt: IsNull() }
      });

      if (!defaultPipeline) {
        return {
          success: false,
          message: 'No default pipeline found for organization'
        };
      }

      // Get first stage of the pipeline
      const firstStage = defaultPipeline.stages.find(stage => stage.orderIndex === 0);
      if (!firstStage) {
        return {
          success: false,
          message: 'No stages found in default pipeline'
        };
      }

      const deal = this.dealRepository.create({
        id: uuidv4(),
        organizationId,
        pipelineId: defaultPipeline.id,
        stageId: firstStage.id,
        title: createDealDto.title,
        description: createDealDto.description,
        value: createDealDto.value,
        currency: createDealDto.currency || 'KZT',
        probability: createDealDto.probability || firstStage.probability,
        customerId: createDealDto.customerId,
        contactId: createDealDto.contactId,
        ownerId: userId,
        assignedTo: createDealDto.assignedTo || userId,
        expectedCloseDate: createDealDto.expectedCloseDate ? new Date(createDealDto.expectedCloseDate) : undefined,
        source: createDealDto.source,
        tags: createDealDto.tags || [],
        customFields: createDealDto.customFields || {},
        status: DealStatus.ACTIVE,
        activitiesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedDeal = await this.dealRepository.save(deal);

      return {
        success: true,
        data: {
          id: savedDeal.id,
          title: savedDeal.title,
          description: savedDeal.description,
          value: savedDeal.value,
          currency: savedDeal.currency,
          probability: savedDeal.probability,
          status: savedDeal.status,
          source: savedDeal.source,
          tags: savedDeal.tags,
          customFields: savedDeal.customFields,
          customerId: savedDeal.customerId,
          contactId: savedDeal.contactId,
          ownerId: savedDeal.ownerId,
          assignedTo: savedDeal.assignedTo,
          pipelineId: savedDeal.pipelineId,
          stageId: savedDeal.stageId,
          expectedCloseDate: savedDeal.expectedCloseDate,
          createdAt: savedDeal.createdAt,
          updatedAt: savedDeal.updatedAt
        },
        message: 'Deal created successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create deal'
      };
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deal by ID' })
  @ApiResponse({ status: 200, description: 'Deal retrieved successfully' })
  async getDeal(@Param('id') id: string, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      const deal = await this.dealRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() },
        relations: ['activities']
      });

      if (!deal) {
        return {
          success: false,
          message: 'Deal not found'
        };
      }

      return {
        success: true,
        data: {
          id: deal.id,
          title: deal.title,
          description: deal.description,
          value: deal.value,
          currency: deal.currency,
          probability: deal.probability,
          status: deal.status,
          source: deal.source,
          tags: deal.tags,
          customFields: deal.customFields,
          customerId: deal.customerId,
          contactId: deal.contactId,
          ownerId: deal.ownerId,
          assignedTo: deal.assignedTo,
          pipelineId: deal.pipelineId,
          stageId: deal.stageId,
          expectedCloseDate: deal.expectedCloseDate,
          actualCloseDate: deal.actualCloseDate,
          lastActivityAt: deal.lastActivityAt,
          activitiesCount: deal.activitiesCount,
          activities: deal.activities?.map(activity => ({
            id: activity.id,
            type: activity.type,
            title: activity.title,
            description: activity.description,
            status: activity.status,
            assignedTo: activity.assignedTo,
            dueDate: activity.dueDate,
            completedAt: activity.completedAt,
            metadata: activity.metadata,
            createdAt: activity.createdAt,
            updatedAt: activity.updatedAt
          })) || [],
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch deal'
      };
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update deal by ID' })
  @ApiResponse({ status: 200, description: 'Deal updated successfully' })
  async updateDeal(@Param('id') id: string, @Body() updateDealDto: UpdateDealDto, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      const deal = await this.dealRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!deal) {
        return {
          success: false,
          message: 'Deal not found'
        };
      }

      // Update deal fields
      Object.assign(deal, {
        ...updateDealDto,
        expectedCloseDate: updateDealDto.expectedCloseDate ? new Date(updateDealDto.expectedCloseDate) : deal.expectedCloseDate,
        updatedAt: new Date()
      });

      const savedDeal = await this.dealRepository.save(deal);

      return {
        success: true,
        data: {
          id: savedDeal.id,
          title: savedDeal.title,
          description: savedDeal.description,
          value: savedDeal.value,
          currency: savedDeal.currency,
          probability: savedDeal.probability,
          status: savedDeal.status,
          source: savedDeal.source,
          tags: savedDeal.tags,
          customFields: savedDeal.customFields,
          customerId: savedDeal.customerId,
          contactId: savedDeal.contactId,
          ownerId: savedDeal.ownerId,
          assignedTo: savedDeal.assignedTo,
          pipelineId: savedDeal.pipelineId,
          stageId: savedDeal.stageId,
          expectedCloseDate: savedDeal.expectedCloseDate,
          actualCloseDate: savedDeal.actualCloseDate,
          lastActivityAt: savedDeal.lastActivityAt,
          activitiesCount: savedDeal.activitiesCount,
          createdAt: savedDeal.createdAt,
          updatedAt: savedDeal.updatedAt
        },
        message: 'Deal updated successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to update deal'
      };
    }
  }

  @Put(':id/move')
  @ApiOperation({ summary: 'Move deal to different stage' })
  @ApiResponse({ status: 200, description: 'Deal moved successfully' })
  async moveDeal(@Param('id') id: string, @Body() moveDealDto: MoveDealDto, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      const deal = await this.dealRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!deal) {
        return {
          success: false,
          message: 'Deal not found'
        };
      }

      // Update deal stage and probability
      deal.stageId = moveDealDto.stageId;
      deal.probability = moveDealDto.probability || deal.probability;
      deal.updatedAt = new Date();

      const savedDeal = await this.dealRepository.save(deal);

      return {
        success: true,
        data: {
          id: savedDeal.id,
          stageId: savedDeal.stageId,
          probability: savedDeal.probability,
          updatedAt: savedDeal.updatedAt
        },
        message: 'Deal moved successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to move deal'
      };
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete deal by ID (soft delete)' })
  @ApiResponse({ status: 200, description: 'Deal deleted successfully' })
  async deleteDeal(@Param('id') id: string, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      const deal = await this.dealRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!deal) {
        return {
          success: false,
          message: 'Deal not found'
        };
      }

      // Soft delete
      await this.dealRepository.update(id, { 
        deletedAt: new Date(),
        updatedAt: new Date()
      });

      return {
        success: true,
        message: 'Deal deleted successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to delete deal'
      };
    }
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'Get activities for deal' })
  @ApiResponse({ status: 200, description: 'Activities retrieved successfully' })
  async getDealActivities(@Param('id') id: string, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      const deal = await this.dealRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!deal) {
        return {
          success: false,
          message: 'Deal not found'
        };
      }

      const activities = await this.activityRepository.find({
        where: { dealId: id, deletedAt: IsNull() },
        order: { createdAt: 'DESC' }
      });

      return {
        success: true,
        data: {
          activities: activities.map(activity => ({
            id: activity.id,
            type: activity.type,
            title: activity.title,
            description: activity.description,
            status: activity.status,
            assignedTo: activity.assignedTo,
            dueDate: activity.dueDate,
            completedAt: activity.completedAt,
            metadata: activity.metadata,
            createdAt: activity.createdAt,
            updatedAt: activity.updatedAt
          }))
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch activities'
      };
    }
  }

  @Post(':id/activities')
  @ApiOperation({ summary: 'Create activity for deal' })
  @ApiResponse({ status: 201, description: 'Activity created successfully' })
  async createActivity(@Param('id') id: string, @Body() createActivityDto: CreateActivityDto, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      const deal = await this.dealRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!deal) {
        return {
          success: false,
          message: 'Deal not found'
        };
      }

      const activity = this.activityRepository.create({
        id: uuidv4(),
        organizationId,
        dealId: id,
        type: createActivityDto.type,
        title: createActivityDto.title,
        description: createActivityDto.description,
        status: 'pending',
        assignedTo: createActivityDto.assignedTo || userId,
        dueDate: createActivityDto.dueDate ? new Date(createActivityDto.dueDate) : undefined,
        metadata: createActivityDto.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedActivity = await this.activityRepository.save(activity);

      // Update deal's last activity and activity count
      await this.dealRepository.update(id, {
        lastActivityAt: new Date(),
        activitiesCount: deal.activitiesCount + 1,
        updatedAt: new Date()
      });

      return {
        success: true,
        data: {
          id: savedActivity.id,
          type: savedActivity.type,
          title: savedActivity.title,
          description: savedActivity.description,
          status: savedActivity.status,
          assignedTo: savedActivity.assignedTo,
          dueDate: savedActivity.dueDate,
          metadata: savedActivity.metadata,
          createdAt: savedActivity.createdAt,
          updatedAt: savedActivity.updatedAt
        },
        message: 'Activity created successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create activity'
      };
    }
  }
}