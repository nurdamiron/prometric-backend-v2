import { Controller, Get, Query, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Organization } from '../auth/entities/user.entity';
import { CustomerPersistenceEntity } from '../domains/customer-relationship-management/customer-lifecycle/infrastructure/persistence/customer.persistence.entity';
import { SalesPipeline, SalesStage, SalesDeal } from '../entities/sales-pipeline.entity';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    @InjectRepository(CustomerPersistenceEntity)
    private readonly customerRepository: Repository<CustomerPersistenceEntity>,

    @InjectRepository(SalesPipeline)
    private readonly pipelineRepository: Repository<SalesPipeline>,

    @InjectRepository(SalesStage)
    private readonly stageRepository: Repository<SalesStage>,

    @InjectRepository(SalesDeal)
    private readonly dealRepository: Repository<SalesDeal>,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get organization overview analytics' })
  @ApiResponse({ status: 200, description: 'Overview analytics retrieved successfully' })
  async getOverview(@Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      // Get basic counts
      const [
        totalCustomers,
        totalDeals,
        totalPipelines,
        totalUsers,
        activeDeals,
        wonDeals,
        lostDeals
      ] = await Promise.all([
        this.customerRepository.count({
          where: { organizationId, deletedAt: null }
        }),
        this.dealRepository.count({
          where: { organizationId, isActive: true }
        }),
        this.pipelineRepository.count({
          where: { organizationId, isActive: true }
        }),
        this.userRepository.count({
          where: { organizationId }
        }),
        this.dealRepository.count({
          where: { organizationId, status: 'active', isActive: true }
        }),
        this.dealRepository.count({
          where: { organizationId, status: 'won', isActive: true }
        }),
        this.dealRepository.count({
          where: { organizationId, status: 'lost', isActive: true }
        })
      ]);

      // Calculate revenue metrics
      const totalRevenueResult = await this.dealRepository
        .createQueryBuilder('deal')
        .select('SUM(deal.amount)', 'total')
        .where('deal.organizationId = :organizationId', { organizationId })
        .andWhere('deal.isActive = true')
        .getRawOne();

      const wonRevenueResult = await this.dealRepository
        .createQueryBuilder('deal')
        .select('SUM(deal.amount)', 'total')
        .where('deal.organizationId = :organizationId', { organizationId })
        .andWhere('deal.status = :status', { status: 'won' })
        .andWhere('deal.isActive = true')
        .getRawOne();

      const weightedRevenueResult = await this.dealRepository
        .createQueryBuilder('deal')
        .select('SUM(deal.amount * deal.probability / 100)', 'total')
        .where('deal.organizationId = :organizationId', { organizationId })
        .andWhere('deal.status = :status', { status: 'active' })
        .andWhere('deal.isActive = true')
        .getRawOne();

      const totalRevenue = parseFloat(totalRevenueResult?.total || '0');
      const wonRevenue = parseFloat(wonRevenueResult?.total || '0');
      const weightedRevenue = parseFloat(weightedRevenueResult?.total || '0');

      // Calculate conversion rate
      const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

      // Calculate average deal size
      const averageDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

      return {
        success: true,
        data: {
          overview: {
            totalCustomers,
            totalDeals,
            totalPipelines,
            totalUsers,
            organizationId
          },
          dealMetrics: {
            activeDeals,
            wonDeals,
            lostDeals,
            conversionRate: Math.round(conversionRate * 100) / 100,
            averageDealSize: Math.round(averageDealSize * 100) / 100
          },
          revenueMetrics: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            wonRevenue: Math.round(wonRevenue * 100) / 100,
            weightedRevenue: Math.round(weightedRevenue * 100) / 100,
            pipeline: Math.round((totalRevenue - wonRevenue) * 100) / 100
          },
          healthScore: this.calculateHealthScore({
            conversionRate,
            averageDealSize,
            totalCustomers,
            activeDeals
          })
        },
        message: 'Organization analytics calculated successfully'
      };
    } catch (error) {
      console.error('Analytics error:', error);
      return {
        success: false,
        message: 'Failed to calculate analytics'
      };
    }
  }

  @Get('sales-funnel')
  @ApiOperation({ summary: 'Get sales funnel analytics' })
  @ApiResponse({ status: 200, description: 'Sales funnel analytics retrieved successfully' })
  @ApiQuery({ name: 'pipelineId', required: false, description: 'Specific pipeline ID' })
  async getSalesFunnel(
    @Req() req: any,
    @Query('pipelineId') pipelineId?: string
  ) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      // Get pipeline(s)
      const pipelineQuery = this.pipelineRepository.createQueryBuilder('pipeline')
        .where('pipeline.organizationId = :organizationId', { organizationId })
        .andWhere('pipeline.isActive = true');

      if (pipelineId) {
        pipelineQuery.andWhere('pipeline.id = :pipelineId', { pipelineId });
      }

      const pipelines = await pipelineQuery.getMany();

      const funnelData = await Promise.all(
        pipelines.map(async (pipeline) => {
          // Get stages for this pipeline
          const stages = await this.stageRepository.find({
            where: { pipelineId: pipeline.id, isActive: true },
            order: { orderIndex: 'ASC' }
          });

          // Get deal counts and values for each stage
          const stageMetrics = await Promise.all(
            stages.map(async (stage) => {
              const [dealsCount, totalValue] = await Promise.all([
                this.dealRepository.count({
                  where: { stageId: stage.id, isActive: true }
                }),
                this.dealRepository
                  .createQueryBuilder('deal')
                  .select('SUM(deal.amount)', 'total')
                  .where('deal.stageId = :stageId', { stageId: stage.id })
                  .andWhere('deal.isActive = true')
                  .getRawOne()
                  .then(result => parseFloat(result?.total || '0'))
              ]);

              return {
                stageId: stage.id,
                stageName: stage.name,
                colorHex: stage.colorHex,
                probability: stage.probability,
                type: stage.type,
                orderIndex: stage.orderIndex,
                dealsCount,
                totalValue: Math.round(totalValue * 100) / 100,
                averageValue: dealsCount > 0 ? Math.round((totalValue / dealsCount) * 100) / 100 : 0,
                conversionRate: stage.orderIndex > 0 ? this.calculateStageConversion(stages, stage.orderIndex) : 100,
                i18n: stage.i18n
              };
            })
          );

          const pipelineTotalValue = stageMetrics.reduce((sum, stage) => sum + stage.totalValue, 0);
          const pipelineTotalDeals = stageMetrics.reduce((sum, stage) => sum + stage.dealsCount, 0);

          return {
            pipelineId: pipeline.id,
            pipelineName: pipeline.name,
            isDefault: pipeline.isDefault,
            totalValue: Math.round(pipelineTotalValue * 100) / 100,
            totalDeals: pipelineTotalDeals,
            stages: stageMetrics,
            funnelEfficiency: this.calculateFunnelEfficiency(stageMetrics)
          };
        })
      );

      return {
        success: true,
        data: {
          funnelAnalysis: funnelData,
          summary: {
            totalPipelines: pipelines.length,
            combinedValue: Math.round(funnelData.reduce((sum, p) => sum + p.totalValue, 0) * 100) / 100,
            combinedDeals: funnelData.reduce((sum, p) => sum + p.totalDeals, 0),
            averageEfficiency: funnelData.length > 0
              ? Math.round((funnelData.reduce((sum, p) => sum + p.funnelEfficiency, 0) / funnelData.length) * 100) / 100
              : 0
          }
        },
        message: 'Sales funnel analytics calculated successfully'
      };
    } catch (error) {
      console.error('Sales funnel analytics error:', error);
      return {
        success: false,
        message: 'Failed to calculate sales funnel analytics'
      };
    }
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get team performance analytics' })
  @ApiResponse({ status: 200, description: 'Performance analytics retrieved successfully' })
  async getPerformance(@Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      // Get user performance data
      const teamPerformance = await this.userRepository
        .createQueryBuilder('user')
        .leftJoin('sales_deals', 'deal', 'deal.ownerId = user.id AND deal.isActive = true')
        .select([
          'user.id',
          'user.firstName',
          'user.lastName',
          'user.role',
          'COUNT(deal.id) as dealsCount',
          'SUM(CASE WHEN deal.status = \'won\' THEN deal.amount ELSE 0 END) as wonRevenue',
          'SUM(CASE WHEN deal.status = \'active\' THEN deal.amount * deal.probability / 100 ELSE 0 END) as weightedPipeline',
          'AVG(CASE WHEN deal.status = \'won\' THEN deal.amount END) as avgDealSize'
        ])
        .where('user.organizationId = :organizationId', { organizationId })
        .andWhere('user.role IN (:...roles)', { roles: ['owner', 'manager', 'employee'] })
        .groupBy('user.id, user.firstName, user.lastName, user.role')
        .getRawMany();

      const performanceData = teamPerformance.map(user => ({
        userId: user.user_id,
        name: `${user.user_firstName} ${user.user_lastName}`,
        role: user.user_role,
        dealsCount: parseInt(user.dealscount || '0'),
        wonRevenue: Math.round(parseFloat(user.wonrevenue || '0') * 100) / 100,
        weightedPipeline: Math.round(parseFloat(user.weightedpipeline || '0') * 100) / 100,
        avgDealSize: Math.round(parseFloat(user.avgdealsize || '0') * 100) / 100,
        efficiency: this.calculateUserEfficiency(user)
      }));

      // Calculate team totals
      const teamTotals = {
        totalDeals: performanceData.reduce((sum, user) => sum + user.dealsCount, 0),
        totalRevenue: performanceData.reduce((sum, user) => sum + user.wonRevenue, 0),
        totalPipeline: performanceData.reduce((sum, user) => sum + user.weightedPipeline, 0),
        averageEfficiency: performanceData.length > 0
          ? performanceData.reduce((sum, user) => sum + user.efficiency, 0) / performanceData.length
          : 0
      };

      return {
        success: true,
        data: {
          teamPerformance: performanceData,
          teamTotals,
          topPerformers: performanceData
            .sort((a, b) => b.wonRevenue - a.wonRevenue)
            .slice(0, 5),
          insights: this.generatePerformanceInsights(performanceData, teamTotals)
        },
        message: 'Team performance analytics calculated successfully'
      };
    } catch (error) {
      console.error('Performance analytics error:', error);
      return {
        success: false,
        message: 'Failed to calculate performance analytics'
      };
    }
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get business trends analytics' })
  @ApiResponse({ status: 200, description: 'Trends analytics retrieved successfully' })
  @ApiQuery({ name: 'period', required: false, description: 'Time period (30d, 90d, 1y)' })
  async getTrends(
    @Req() req: any,
    @Query('period') period = '30d'
  ) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      const days = this.periodToDays(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Customer trends
      const customerTrends = await this.customerRepository
        .createQueryBuilder('customer')
        .select([
          'DATE(customer.createdAt) as date',
          'COUNT(*) as count',
          'SUM(customer.potentialValue) as potentialValue'
        ])
        .where('customer.organizationId = :organizationId', { organizationId })
        .andWhere('customer.createdAt >= :startDate', { startDate })
        .andWhere('customer.deletedAt IS NULL')
        .groupBy('DATE(customer.createdAt)')
        .orderBy('date', 'ASC')
        .getRawMany();

      // Deal trends
      const dealTrends = await this.dealRepository
        .createQueryBuilder('deal')
        .select([
          'DATE(deal.createdAt) as date',
          'COUNT(*) as count',
          'SUM(deal.amount) as totalValue',
          'SUM(CASE WHEN deal.status = \'won\' THEN deal.amount ELSE 0 END) as wonValue'
        ])
        .where('deal.organizationId = :organizationId', { organizationId })
        .andWhere('deal.createdAt >= :startDate', { startDate })
        .andWhere('deal.isActive = true')
        .groupBy('DATE(deal.createdAt)')
        .orderBy('date', 'ASC')
        .getRawMany();

      // Calculate growth rates
      const customerGrowth = this.calculateGrowthRate(customerTrends, 'count');
      const revenueGrowth = this.calculateGrowthRate(dealTrends, 'wonvalue');

      return {
        success: true,
        data: {
          period: `${days} days`,
          customerTrends: customerTrends.map(trend => ({
            date: trend.date,
            newCustomers: parseInt(trend.count),
            potentialValue: Math.round(parseFloat(trend.potentialvalue || '0') * 100) / 100
          })),
          dealTrends: dealTrends.map(trend => ({
            date: trend.date,
            newDeals: parseInt(trend.count),
            totalValue: Math.round(parseFloat(trend.totalvalue || '0') * 100) / 100,
            wonValue: Math.round(parseFloat(trend.wonvalue || '0') * 100) / 100
          })),
          growthMetrics: {
            customerGrowth: Math.round(customerGrowth * 100) / 100,
            revenueGrowth: Math.round(revenueGrowth * 100) / 100,
            trendDirection: customerGrowth > 0 ? 'growing' : customerGrowth < 0 ? 'declining' : 'stable'
          },
          predictions: this.generatePredictions(customerTrends, dealTrends)
        },
        message: 'Business trends calculated successfully'
      };
    } catch (error) {
      console.error('Trends analytics error:', error);
      return {
        success: false,
        message: 'Failed to calculate trends analytics'
      };
    }
  }

  // PRIVATE HELPER METHODS

  private calculateHealthScore(metrics: any): number {
    let score = 50; // Base score

    // Conversion rate impact (0-25 points)
    if (metrics.conversionRate > 20) score += 25;
    else if (metrics.conversionRate > 15) score += 20;
    else if (metrics.conversionRate > 10) score += 15;
    else if (metrics.conversionRate > 5) score += 10;

    // Customer base impact (0-15 points)
    if (metrics.totalCustomers > 100) score += 15;
    else if (metrics.totalCustomers > 50) score += 10;
    else if (metrics.totalCustomers > 20) score += 5;

    // Active deals impact (0-10 points)
    if (metrics.activeDeals > 20) score += 10;
    else if (metrics.activeDeals > 10) score += 7;
    else if (metrics.activeDeals > 5) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  private calculateStageConversion(stages: any[], currentIndex: number): number {
    if (currentIndex === 0) return 100;

    const currentStageDeals = stages[currentIndex]?.dealsCount || 0;
    const previousStageDeals = stages[currentIndex - 1]?.dealsCount || 0;

    if (previousStageDeals === 0) return 0;

    return Math.round((currentStageDeals / previousStageDeals) * 10000) / 100;
  }

  private calculateFunnelEfficiency(stageMetrics: any[]): number {
    if (stageMetrics.length === 0) return 0;

    const normalStages = stageMetrics.filter(s => s.type === 'normal');
    if (normalStages.length === 0) return 100;

    const firstStage = normalStages[0];
    const lastNormalStage = normalStages[normalStages.length - 1];

    if (firstStage.dealsCount === 0) return 0;

    return Math.round((lastNormalStage.dealsCount / firstStage.dealsCount) * 10000) / 100;
  }

  private calculateUserEfficiency(userMetrics: any): number {
    const dealsCount = parseInt(userMetrics.dealscount || '0');
    const wonRevenue = parseFloat(userMetrics.wonrevenue || '0');

    if (dealsCount === 0) return 0;

    // Simple efficiency: revenue per deal
    const revenuePerDeal = wonRevenue / dealsCount;

    // Scale to 0-100
    return Math.min(100, Math.round((revenuePerDeal / 10000) * 100)); // Assuming 100k KZT is 100% efficiency
  }

  private periodToDays(period: string): number {
    switch (period) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      default: return 30;
    }
  }

  private calculateGrowthRate(trends: any[], valueField: string): number {
    if (trends.length < 2) return 0;

    const firstPeriodValue = parseFloat(trends[0][valueField] || '0');
    const lastPeriodValue = parseFloat(trends[trends.length - 1][valueField] || '0');

    if (firstPeriodValue === 0) return lastPeriodValue > 0 ? 100 : 0;

    return ((lastPeriodValue - firstPeriodValue) / firstPeriodValue) * 100;
  }

  private generatePredictions(customerTrends: any[], dealTrends: any[]) {
    // Simple trend-based predictions
    const customerGrowth = this.calculateGrowthRate(customerTrends, 'count');
    const revenueGrowth = this.calculateGrowthRate(dealTrends, 'wonvalue');

    return {
      nextMonth: {
        expectedCustomers: Math.round(customerTrends.length > 0 ?
          parseInt(customerTrends[customerTrends.length - 1].count) * (1 + customerGrowth / 100) : 0),
        expectedRevenue: Math.round(dealTrends.length > 0 ?
          parseFloat(dealTrends[dealTrends.length - 1].wonvalue || '0') * (1 + revenueGrowth / 100) : 0),
        confidence: customerTrends.length > 7 ? 'high' : customerTrends.length > 3 ? 'medium' : 'low'
      }
    };
  }

  private generatePerformanceInsights(performanceData: any[], teamTotals: any) {
    const insights = [];

    if (teamTotals.averageEfficiency > 80) {
      insights.push('🎉 Команда показывает отличные результаты!');
    } else if (teamTotals.averageEfficiency > 60) {
      insights.push('📈 Команда работает хорошо, есть потенциал для роста');
    } else {
      insights.push('⚠️ Команде нужна поддержка и обучение');
    }

    const topPerformer = performanceData.sort((a, b) => b.wonRevenue - a.wonRevenue)[0];
    if (topPerformer) {
      insights.push(`🏆 Лидер продаж: ${topPerformer.name} (${topPerformer.wonRevenue.toLocaleString()} тенге)`);
    }

    if (teamTotals.totalPipeline > teamTotals.totalRevenue * 2) {
      insights.push('💼 Большой потенциал в pipeline - фокус на закрытие сделок');
    }

    return insights;
  }
}