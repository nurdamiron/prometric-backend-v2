import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesPipeline, SalesStage, SalesDeal } from '../entities/sales-pipeline.entity';
import { Organization } from '../auth/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

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

@Injectable()
export class SalesPipelineService {
  constructor(
    @InjectRepository(SalesPipeline)
    private pipelineRepository: Repository<SalesPipeline>,

    @InjectRepository(SalesStage)
    private stageRepository: Repository<SalesStage>,

    @InjectRepository(SalesDeal)
    private dealRepository: Repository<SalesDeal>,

    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  async pipelines(organizationId: string) {
    try {
      let pipelines = await this.pipelineRepository.find({
        where: { organizationId, isActive: true },
        order: { orderIndex: 'ASC' }
      });

      // If no pipelines exist, create default one
      if (pipelines.length === 0) {
        const defaultPipeline = await this.createDefaultPipeline(organizationId);
        pipelines = [defaultPipeline];
      }

      // Get pipeline stats
      const pipelineStats = await Promise.all(
        pipelines.map(async (pipeline) => {
          const stagesCount = await this.stageRepository.count({
            where: { pipelineId: pipeline.id, isActive: true }
          });

          const dealsCount = await this.dealRepository.count({
            where: { pipelineId: pipeline.id, isActive: true }
          });

          const totalValue = await this.dealRepository
            .createQueryBuilder('deal')
            .select('SUM(deal.amount)', 'total')
            .where('deal.pipelineId = :pipelineId', { pipelineId: pipeline.id })
            .andWhere('deal.isActive = true')
            .getRawOne();

          const wonValue = await this.dealRepository
            .createQueryBuilder('deal')
            .select('SUM(deal.amount)', 'total')
            .where('deal.pipelineId = :pipelineId', { pipelineId: pipeline.id })
            .andWhere('deal.status = :status', { status: 'won' })
            .andWhere('deal.isActive = true')
            .getRawOne();

          return {
            id: pipeline.id,
            name: pipeline.name,
            description: pipeline.description,
            isDefault: pipeline.isDefault,
            orderIndex: pipeline.orderIndex,
            stagesCount,
            dealsCount,
            totalValue: parseFloat(totalValue?.total || '0'),
            wonValue: parseFloat(wonValue?.total || '0'),
            createdAt: pipeline.createdAt
          };
        })
      );

      return {
        success: true,
        data: pipelineStats,
        message: 'Pipelines retrieved successfully'
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch pipelines');
    }
  }

  async createPipeline(organizationId: string, data: {
    name: string;
    description?: string;
    isDefault?: boolean;
  }, createdBy: string) {
    try {
      // Validate organization exists
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      // If this will be default, unset other defaults
      if (data.isDefault) {
        await this.pipelineRepository.update(
          { organizationId, isDefault: true },
          { isDefault: false }
        );
      }

      // Create pipeline
      const pipeline = this.pipelineRepository.create({
        organizationId,
        name: sanitizeInput(data.name),
        description: data.description ? sanitizeInput(data.description) : null,
        isDefault: data.isDefault || false,
        orderIndex: await this.getNextOrderIndex(organizationId),
        createdBy
      });

      const savedPipeline = await this.pipelineRepository.save(pipeline);

      // Create default stages
      await this.createDefaultStages(savedPipeline.id);

      return {
        success: true,
        data: {
          id: savedPipeline.id,
          name: savedPipeline.name,
          description: savedPipeline.description,
          isDefault: savedPipeline.isDefault,
          organizationId: savedPipeline.organizationId,
          stagesCount: 6,
          createdAt: savedPipeline.createdAt
        },
        message: 'Pipeline created successfully with default stages'
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create pipeline');
    }
  }

  async stages(pipelineId: string, organizationId: string) {
    try {
      // Verify pipeline belongs to organization
      const pipeline = await this.pipelineRepository.findOne({
        where: { id: pipelineId, organizationId }
      });

      if (!pipeline) {
        throw new NotFoundException('Pipeline not found');
      }

      const stages = await this.stageRepository.find({
        where: { pipelineId, isActive: true },
        order: { orderIndex: 'ASC' }
      });

      // Get deal counts for each stage
      const stageStats = await Promise.all(
        stages.map(async (stage) => {
          const dealsCount = await this.dealRepository.count({
            where: { stageId: stage.id, isActive: true }
          });

          const totalValue = await this.dealRepository
            .createQueryBuilder('deal')
            .select('SUM(deal.amount)', 'total')
            .where('deal.stageId = :stageId', { stageId: stage.id })
            .andWhere('deal.isActive = true')
            .getRawOne();

          return {
            id: stage.id,
            name: stage.name,
            slug: stage.slug,
            colorHex: stage.colorHex,
            probability: stage.probability,
            type: stage.type,
            orderIndex: stage.orderIndex,
            wipLimit: stage.wipLimit,
            isWipLimitExceeded: stage.wipLimit !== null && dealsCount > stage.wipLimit,
            availableCapacity: stage.wipLimit !== null ? Math.max(0, stage.wipLimit - dealsCount) : null,
            dealsCount,
            totalValue: parseFloat(totalValue?.total || '0'),
            averageDealValue: dealsCount > 0 ? parseFloat(totalValue?.total || '0') / dealsCount : 0,
            i18n: stage.i18n,
            isTerminal: stage.type === 'won' || stage.type === 'lost'
          };
        })
      );

      return {
        success: true,
        data: {
          pipelineId,
          pipeline: {
            name: pipeline.name,
            description: pipeline.description
          },
          stages: stageStats,
          totalStages: stages.length,
          normalStages: stages.filter(s => s.type === 'normal').length,
          terminalStages: stages.filter(s => s.type !== 'normal').length
        },
        message: 'Pipeline stages retrieved successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch pipeline stages');
    }
  }

  async createDeal(organizationId: string, data: {
    pipelineId: string;
    customerId: string;
    dealName: string;
    description?: string;
    amount: number;
    currency?: string;
    expectedCloseDate?: string;
    ownerId: string;
  }, createdBy: string) {
    try {
      // Verify pipeline belongs to organization
      const pipeline = await this.pipelineRepository.findOne({
        where: { id: data.pipelineId, organizationId }
      });

      if (!pipeline) {
        throw new NotFoundException('Pipeline not found');
      }

      // Get first stage of pipeline
      const firstStage = await this.stageRepository.findOne({
        where: { pipelineId: data.pipelineId, isActive: true },
        order: { orderIndex: 'ASC' }
      });

      if (!firstStage) {
        throw new BadRequestException('No active stages found in pipeline');
      }

      // Create deal
      const deal = this.dealRepository.create({
        organizationId,
        pipelineId: data.pipelineId,
        stageId: firstStage.id,
        customerId: data.customerId,
        dealName: sanitizeInput(data.dealName),
        description: data.description ? sanitizeInput(data.description) : null,
        amount: data.amount,
        currency: data.currency || 'KZT',
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        probability: firstStage.probability,
        ownerId: data.ownerId,
        createdBy
      });

      const savedDeal = await this.dealRepository.save(deal);

      return {
        success: true,
        data: {
          id: savedDeal.id,
          dealName: savedDeal.dealName,
          amount: savedDeal.amount,
          currency: savedDeal.currency,
          status: savedDeal.status,
          probability: savedDeal.probability,
          stageName: firstStage.name,
          createdAt: savedDeal.createdAt
        },
        message: 'Deal created successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create deal');
    }
  }

  async deals(organizationId: string, pipelineId?: string, stageId?: string, page = 1, limit = 20) {
    try {
      const query = this.dealRepository.createQueryBuilder('deal')
        .where('deal.organizationId = :organizationId', { organizationId })
        .andWhere('deal.isActive = true');

      if (pipelineId) {
        query.andWhere('deal.pipelineId = :pipelineId', { pipelineId });
      }

      if (stageId) {
        query.andWhere('deal.stageId = :stageId', { stageId });
      }

      const [deals, total] = await query
        .orderBy('deal.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      // Get additional data for each deal
      const dealData = await Promise.all(
        deals.map(async (deal) => {
          const stage = await this.stageRepository.findOne({
            where: { id: deal.stageId }
          });

          return {
            id: deal.id,
            dealName: deal.dealName,
            description: deal.description,
            amount: deal.amount,
            currency: deal.currency,
            formattedAmount: new Intl.NumberFormat('kk-KZ', {
              style: 'currency',
              currency: deal.currency,
              minimumFractionDigits: 0,
            }).format(deal.amount),
            status: deal.status,
            probability: deal.probability,
            weightedValue: (deal.amount * deal.probability) / 100,
            stage: {
              id: stage?.id,
              name: stage?.name,
              colorHex: stage?.colorHex,
              type: stage?.type
            },
            ownerId: deal.ownerId,
            customerId: deal.customerId,
            expectedCloseDate: deal.expectedCloseDate,
            daysUntilExpectedClose: deal.expectedCloseDate ?
              Math.ceil((deal.expectedCloseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
            isOverdue: deal.expectedCloseDate ? new Date() > deal.expectedCloseDate : false,
            ageInDays: Math.ceil((Date.now() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
            tags: deal.tags,
            notes: deal.notes,
            createdAt: deal.createdAt
          };
        })
      );

      return {
        success: true,
        data: {
          deals: dealData,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        },
        message: 'Deals retrieved successfully'
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch deals');
    }
  }

  async moveDeal(dealId: string, stageId: string, organizationId: string, movedBy: string) {
    try {
      // Verify deal belongs to organization
      const deal = await this.dealRepository.findOne({
        where: { id: dealId, organizationId }
      });

      if (!deal) {
        throw new NotFoundException('Deal not found');
      }

      // Verify stage exists and belongs to same pipeline
      const stage = await this.stageRepository.findOne({
        where: { id: stageId, pipelineId: deal.pipelineId }
      });

      if (!stage) {
        throw new NotFoundException('Stage not found');
      }

      // Check WIP limit
      if (stage.wipLimit !== null) {
        const currentDealsInStage = await this.dealRepository.count({
          where: { stageId, isActive: true }
        });

        if (currentDealsInStage >= stage.wipLimit) {
          throw new BadRequestException(`Stage "${stage.name}" has reached WIP limit (${stage.wipLimit})`);
        }
      }

      // Update deal
      await this.dealRepository.update(dealId, {
        stageId,
        probability: stage.probability,
        status: stage.type === 'won' ? 'won' : stage.type === 'lost' ? 'lost' : 'active',
        closedDate: stage.type !== 'normal' ? new Date() : null
      });

      return {
        success: true,
        data: {
          dealId,
          newStageId: stageId,
          newStageName: stage.name,
          newProbability: stage.probability,
          movedAt: new Date().toISOString()
        },
        message: `Deal moved to "${stage.name}" stage`
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to move deal');
    }
  }

  // PRIVATE HELPER METHODS

  private async createDefaultPipeline(organizationId: string): Promise<SalesPipeline> {
    const pipeline = this.pipelineRepository.create({
      organizationId,
      name: 'Sales Pipeline',
      description: 'Standard B2B sales process',
      isDefault: true,
      orderIndex: 0,
      createdBy: organizationId // Will be updated later
    });

    const savedPipeline = await this.pipelineRepository.save(pipeline);
    await this.createDefaultStages(savedPipeline.id);

    return savedPipeline;
  }

  private async createDefaultStages(pipelineId: string) {
    const defaultStages = [
      {
        name: 'Лиды',
        slug: 'leads',
        colorHex: '#64748B',
        probability: 10,
        type: 'normal' as const,
        orderIndex: 0,
        i18n: { ru: 'Лиды', kk: 'Жетекші', en: 'Leads' }
      },
      {
        name: 'Квалификация',
        slug: 'qualification',
        colorHex: '#3B82F6',
        probability: 25,
        type: 'normal' as const,
        orderIndex: 1,
        i18n: { ru: 'Квалификация', kk: 'Біліктілік', en: 'Qualification' }
      },
      {
        name: 'Предложение',
        slug: 'proposal',
        colorHex: '#8B5CF6',
        probability: 50,
        type: 'normal' as const,
        orderIndex: 2,
        wipLimit: 5,
        i18n: { ru: 'Предложение', kk: 'Ұсыныс', en: 'Proposal' }
      },
      {
        name: 'Переговоры',
        slug: 'negotiation',
        colorHex: '#F59E0B',
        probability: 75,
        type: 'normal' as const,
        orderIndex: 3,
        wipLimit: 3,
        i18n: { ru: 'Переговоры', kk: 'Келіссөздер', en: 'Negotiation' }
      },
      {
        name: 'Выиграли',
        slug: 'won',
        colorHex: '#10B981',
        probability: 100,
        type: 'won' as const,
        orderIndex: 4,
        i18n: { ru: 'Выиграли', kk: 'Жеңдік', en: 'Won' }
      },
      {
        name: 'Проиграли',
        slug: 'lost',
        colorHex: '#EF4444',
        probability: 0,
        type: 'lost' as const,
        orderIndex: 5,
        i18n: { ru: 'Проиграли', kk: 'Жеңіліс', en: 'Lost' }
      }
    ];

    for (const stageData of defaultStages) {
      const stage = this.stageRepository.create({
        pipelineId,
        ...stageData
      });
      await this.stageRepository.save(stage);
    }
  }

  private async getNextOrderIndex(organizationId: string): Promise<number> {
    const lastPipeline = await this.pipelineRepository.findOne({
      where: { organizationId },
      order: { orderIndex: 'DESC' }
    });
    return (lastPipeline?.orderIndex || 0) + 1;
  }
}