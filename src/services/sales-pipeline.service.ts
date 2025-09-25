import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

@Injectable()
export class SalesPipelineService {
  constructor() {
    // Simplified service without database dependencies for now
  }

  async pipelines(organizationId: string) {
    try {
      // Mock response with Kazakhstan sales pipeline
      return {
        success: true,
        data: [
          {
            id: 'pipeline-' + Date.now(),
            name: 'Sales Pipeline',
            description: 'Standard B2B sales process',
            isDefault: true,
            orderIndex: 0,
            stagesCount: 6,
            dealsCount: 0,
            totalValue: 0,
            wonValue: 0,
            createdAt: new Date().toISOString()
          }
        ],
        message: 'Sales pipeline ready - Kazakhstan localization active'
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
      return {
        success: true,
        data: {
          id: 'pipeline-' + Date.now(),
          name: data.name,
          description: data.description,
          isDefault: data.isDefault || false,
          organizationId,
          stagesCount: 6,
          createdAt: new Date().toISOString()
        },
        message: 'Pipeline created successfully'
      };
    } catch (error) {
      throw new BadRequestException('Failed to create pipeline');
    }
  }

  async stages(pipelineId: string, organizationId: string) {
    try {
      // Kazakhstan sales stages with localization
      const stages = [
        {
          id: 'stage-leads',
          name: 'Лиды',
          slug: 'leads',
          colorHex: '#64748B',
          probability: 10,
          type: 'normal',
          orderIndex: 0,
          dealsCount: 0,
          totalValue: 0,
          i18n: { ru: 'Лиды', kk: 'Жетекші', en: 'Leads' }
        },
        {
          id: 'stage-qualification',
          name: 'Квалификация',
          slug: 'qualification',
          colorHex: '#3B82F6',
          probability: 25,
          type: 'normal',
          orderIndex: 1,
          dealsCount: 0,
          totalValue: 0,
          i18n: { ru: 'Квалификация', kk: 'Біліктілік', en: 'Qualification' }
        },
        {
          id: 'stage-proposal',
          name: 'Предложение',
          slug: 'proposal',
          colorHex: '#8B5CF6',
          probability: 50,
          type: 'normal',
          orderIndex: 2,
          dealsCount: 0,
          totalValue: 0,
          i18n: { ru: 'Предложение', kk: 'Ұсыныс', en: 'Proposal' }
        },
        {
          id: 'stage-negotiation',
          name: 'Переговоры',
          slug: 'negotiation',
          colorHex: '#F59E0B',
          probability: 75,
          type: 'normal',
          orderIndex: 3,
          dealsCount: 0,
          totalValue: 0,
          i18n: { ru: 'Переговоры', kk: 'Келіссөздер', en: 'Negotiation' }
        },
        {
          id: 'stage-won',
          name: 'Выиграли',
          slug: 'won',
          colorHex: '#10B981',
          probability: 100,
          type: 'won',
          orderIndex: 4,
          dealsCount: 0,
          totalValue: 0,
          i18n: { ru: 'Выиграли', kk: 'Жеңдік', en: 'Won' }
        },
        {
          id: 'stage-lost',
          name: 'Проиграли',
          slug: 'lost',
          colorHex: '#EF4444',
          probability: 0,
          type: 'lost',
          orderIndex: 5,
          dealsCount: 0,
          totalValue: 0,
          i18n: { ru: 'Проиграли', kk: 'Жеңіліс', en: 'Lost' }
        }
      ];

      return {
        success: true,
        data: {
          pipelineId,
          stages,
          totalStages: stages.length,
          normalStages: stages.filter(s => s.type === 'normal').length,
          terminalStages: stages.filter(s => s.type !== 'normal').length
        },
        message: 'Kazakhstan sales stages ready'
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch pipeline stages');
    }
  }
}