import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  LearningEvent,
  LearningEventType,
  LearningInsight,
  InsightType,
  InsightImpact,
  InsightStatus,
  UserInteractionPattern,
  OrganizationLearningProfile,
  LearningEventRecordedEvent,
  InsightGeneratedEvent
} from '../domain/learning.domain';
import { LearningEventEntity } from '../infrastructure/persistence/learning.entity';

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    @InjectRepository(LearningEventEntity)
    private readonly learningEventRepository: Repository<LearningEventEntity>
  ) {}

  async recordLearningEvent(event: Omit<LearningEvent, 'id' | 'timestamp' | 'processed'>): Promise<string> {
    const entity = this.learningEventRepository.create({
      ...event,
      timestamp: new Date(),
      processed: false
    });

    const saved = await this.learningEventRepository.save(entity);

    // Emit domain event
    const domainEvent = new LearningEventRecordedEvent(
      saved.id,
      event.organizationId,
      event.eventType,
      event.userId
    );

    this.logger.debug(`Learning event recorded: ${event.eventType}`, {
      userId: event.userId,
      organizationId: event.organizationId
    });

    return saved.id;
  }

  async recordUserFeedback(
    userId: string,
    organizationId: string,
    conversationId: string,
    messageId: string,
    rating: number,
    feedback?: string
  ): Promise<void> {
    await this.recordLearningEvent({
      userId,
      organizationId,
      eventType: LearningEventType.USER_FEEDBACK,
      payload: {
        conversationId,
        messageId,
        rating,
        feedback
      },
      metadata: {
        aiModel: 'gemini-2.5-flash', // TODO: Get from context
        personality: 'professional',
        expertise: [],
        language: 'ru'
      }
    });

    this.logger.log(`User feedback recorded: ${rating}/5`, {
      userId,
      conversationId,
      feedback
    });
  }

  async recordFunctionExecution(
    userId: string,
    organizationId: string,
    functionName: string,
    success: boolean,
    processingTime: number,
    error?: string
  ): Promise<void> {
    await this.recordLearningEvent({
      userId,
      organizationId,
      eventType: LearningEventType.FUNCTION_EXECUTED,
      payload: {
        functionName,
        actualOutcome: success ? 'success' : 'failure',
        errorType: error
      },
      metadata: {
        aiModel: 'gemini-2.5-flash',
        personality: 'professional',
        expertise: [],
        language: 'ru',
        processingTime
      }
    });
  }

  async recordConversationCompleted(
    userId: string,
    organizationId: string,
    conversationId: string,
    messageCount: number,
    totalTokens: number,
    duration: number
  ): Promise<void> {
    await this.recordLearningEvent({
      userId,
      organizationId,
      eventType: LearningEventType.CONVERSATION_COMPLETED,
      payload: {
        conversationId,
        context: {
          messageCount,
          totalTokens,
          duration
        }
      },
      metadata: {
        aiModel: 'gemini-2.5-flash',
        personality: 'professional',
        expertise: [],
        language: 'ru',
        processingTime: duration
      }
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processLearningEvents(): Promise<void> {
    this.logger.log('Processing learning events...');

    const unprocessedEvents = await this.learningEventRepository.find({
      where: { processed: false },
      take: 100, // Process in batches
      order: { timestamp: 'ASC' }
    });

    for (const event of unprocessedEvents) {
      try {
        await this.processIndividualEvent(event);

        // Mark as processed
        await this.learningEventRepository.update(event.id, { processed: true });

      } catch (error) {
        this.logger.error(`Failed to process learning event ${event.id}`, error);
      }
    }

    this.logger.log(`Processed ${unprocessedEvents.length} learning events`);
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async generateInsights(): Promise<void> {
    this.logger.log('Generating learning insights...');

    // Get all organizations with recent activity
    const activeOrgs = await this.getActiveOrganizations();

    for (const orgId of activeOrgs) {
      try {
        const insights = await this.analyzeOrganizationPatterns(orgId);

        for (const insight of insights) {
          await this.storeInsight(insight);

          // Emit event for high-impact insights
          if (insight.impact === InsightImpact.HIGH || insight.impact === InsightImpact.CRITICAL) {
            const event = new InsightGeneratedEvent(
              insight.id,
              insight.organizationId,
              insight.insightType,
              insight.impact,
              insight.confidence
            );

            this.logger.warn(`Critical insight generated for org ${orgId}: ${insight.title}`);
          }
        }

      } catch (error) {
        this.logger.error(`Failed to generate insights for org ${orgId}`, error);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generateDailyLearningReport(): Promise<void> {
    this.logger.log('Generating daily learning report...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const dailyEvents = await this.learningEventRepository.find({
      where: {
        timestamp: yesterday // This would need proper date range query
      }
    });

    // Aggregate learning metrics
    const metrics = this.aggregateLearningMetrics(dailyEvents);

    // TODO: Send report to stakeholders
    this.logger.log('Daily learning report generated', metrics);
  }

  async getUserInteractionPattern(userId: string): Promise<UserInteractionPattern> {
    const userEvents = await this.learningEventRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: 1000 // Last 1000 events
    });

    if (userEvents.length === 0) {
      throw new Error(`No learning data found for user ${userId}`);
    }

    return this.analyzeUserPattern(userEvents);
  }

  async getOrganizationLearningProfile(organizationId: string): Promise<OrganizationLearningProfile> {
    const orgEvents = await this.learningEventRepository.find({
      where: { organizationId },
      order: { timestamp: 'DESC' },
      take: 5000 // Last 5000 events
    });

    if (orgEvents.length === 0) {
      throw new Error(`No learning data found for organization ${organizationId}`);
    }

    return this.buildOrganizationProfile(orgEvents);
  }

  async getInsightsForOrganization(
    organizationId: string,
    status?: InsightStatus,
    limit: number = 10
  ): Promise<LearningInsight[]> {
    // TODO: Implement proper insights storage and retrieval
    throw new Error('Insights storage not yet implemented');
  }

  async applyInsight(insightId: string): Promise<void> {
    // TODO: Implement insight application logic
    throw new Error('Insight application not yet implemented');
  }

  private async processIndividualEvent(event: LearningEventEntity): Promise<void> {
    // Process different types of learning events
    switch (event.eventType) {
      case LearningEventType.USER_FEEDBACK:
        await this.processFeedbackEvent(event);
        break;

      case LearningEventType.FUNCTION_EXECUTED:
        await this.processFunctionEvent(event);
        break;

      case LearningEventType.CONVERSATION_COMPLETED:
        await this.processConversationEvent(event);
        break;

      default:
        this.logger.debug(`Unhandled event type: ${event.eventType}`);
    }
  }

  private async processFeedbackEvent(event: LearningEventEntity): Promise<void> {
    const rating = event.payload.rating;

    if (rating && rating <= 2) {
      // Low rating - analyze for improvement
      this.logger.warn(`Low user rating detected: ${rating}/5`, {
        userId: event.userId,
        conversationId: event.payload.conversationId
      });
    }
  }

  private async processFunctionEvent(event: LearningEventEntity): Promise<void> {
    const success = event.payload.actualOutcome === 'success';

    if (!success) {
      // Function failure - log for analysis
      this.logger.warn(`Function execution failed: ${event.payload.functionName}`, {
        error: event.payload.errorType,
        userId: event.userId
      });
    }
  }

  private async processConversationEvent(event: LearningEventEntity): Promise<void> {
    const context = event.payload.context;

    if (context && context.duration > 300000) { // 5 minutes
      // Long conversation - potential inefficiency
      this.logger.debug(`Long conversation detected: ${context.duration}ms`, {
        userId: event.userId,
        messageCount: context.messageCount
      });
    }
  }

  private async getActiveOrganizations(): Promise<string[]> {
    const recentEvents = await this.learningEventRepository
      .createQueryBuilder('event')
      .select('DISTINCT event.organizationId')
      .where('event.timestamp > :date', {
        date: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      })
      .getRawMany();

    return recentEvents.map(e => e.organizationId);
  }

  private async analyzeOrganizationPatterns(organizationId: string): Promise<LearningInsight[]> {
    // TODO: Implement sophisticated pattern analysis
    const insights: LearningInsight[] = [];

    // Example insight generation logic
    const events = await this.learningEventRepository.find({
      where: { organizationId },
      order: { timestamp: 'DESC' },
      take: 1000
    });

    // Analyze feedback patterns
    const feedbackEvents = events.filter(e => e.eventType === LearningEventType.USER_FEEDBACK);
    const avgRating = feedbackEvents.reduce((sum, e) => sum + (e.payload.rating || 0), 0) / feedbackEvents.length;

    if (avgRating < 3.5 && feedbackEvents.length > 10) {
      insights.push({
        id: this.generateInsightId(),
        organizationId,
        insightType: InsightType.PERFORMANCE_ISSUE,
        title: 'Низкая удовлетворенность пользователей',
        description: `Средний рейтинг AI ассистента составляет ${avgRating.toFixed(1)}/5`,
        confidence: 0.85,
        impact: InsightImpact.HIGH,
        recommendations: [
          'Проанализировать негативные отзывы',
          'Обновить базу знаний',
          'Настроить личность ассистента'
        ],
        dataPoints: feedbackEvents.length,
        createdAt: new Date(),
        status: InsightStatus.PENDING
      });
    }

    return insights;
  }

  private async storeInsight(insight: LearningInsight): Promise<void> {
    // TODO: Store insights in database
    this.logger.log(`Insight stored: ${insight.title}`, {
      organizationId: insight.organizationId,
      type: insight.insightType,
      impact: insight.impact
    });
  }

  private aggregateLearningMetrics(events: LearningEventEntity[]): any {
    return {
      totalEvents: events.length,
      feedbackEvents: events.filter(e => e.eventType === LearningEventType.USER_FEEDBACK).length,
      functionEvents: events.filter(e => e.eventType === LearningEventType.FUNCTION_EXECUTED).length,
      conversationEvents: events.filter(e => e.eventType === LearningEventType.CONVERSATION_COMPLETED).length,
      averageRating: this.calculateAverageRating(events),
      functionSuccessRate: this.calculateFunctionSuccessRate(events)
    };
  }

  private calculateAverageRating(events: LearningEventEntity[]): number {
    const feedbackEvents = events.filter(e => e.eventType === LearningEventType.USER_FEEDBACK);

    if (feedbackEvents.length === 0) return 0;

    const totalRating = feedbackEvents.reduce((sum, e) => sum + (e.payload.rating || 0), 0);
    return totalRating / feedbackEvents.length;
  }

  private calculateFunctionSuccessRate(events: LearningEventEntity[]): number {
    const functionEvents = events.filter(e => e.eventType === LearningEventType.FUNCTION_EXECUTED);

    if (functionEvents.length === 0) return 0;

    const successfulFunctions = functionEvents.filter(e => e.payload.actualOutcome === 'success').length;
    return successfulFunctions / functionEvents.length;
  }

  private async analyzeUserPattern(events: LearningEventEntity[]): Promise<UserInteractionPattern> {
    // TODO: Implement user pattern analysis
    if (events.length === 0) {
      throw new Error('No events provided for analysis');
    }
    const userId = events[0]!.userId;
    const organizationId = events[0]!.organizationId;

    return {
      userId,
      organizationId,
      preferredPersonality: 'professional',
      commonQuestions: [],
      averageSessionLength: 0,
      preferredFunctions: [],
      successfulIntents: [],
      problematicAreas: [],
      satisfactionScore: 0,
      updatedAt: new Date()
    };
  }

  private async buildOrganizationProfile(events: LearningEventEntity[]): Promise<OrganizationLearningProfile> {
    // TODO: Build comprehensive organization profile
    if (events.length === 0) {
      throw new Error('No events provided for analysis');
    }
    const organizationId = events[0]!.organizationId;

    return {
      organizationId,
      industry: 'unknown',
      commonUseCases: [],
      successfulPatterns: [],
      knowledgeGaps: [],
      performanceMetrics: {
        averageResponseTime: 0,
        successRate: 0,
        userSatisfactionScore: 0,
        functionSuccessRate: 0,
        knowledgeCoverage: 0,
        improvementTrend: 'stable'
      },
      recommendations: [],
      lastAnalyzed: new Date()
    };
  }

  private generateInsightId(): string {
    return `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}