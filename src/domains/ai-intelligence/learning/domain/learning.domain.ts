// Learning Domain - Handles AI continuous learning and improvement

export interface LearningEvent {
  id: string;
  userId: string;
  organizationId: string;
  eventType: LearningEventType;
  payload: LearningPayload;
  timestamp: Date;
  processed: boolean;
  metadata: LearningMetadata;
}

export enum LearningEventType {
  USER_FEEDBACK = 'user_feedback',
  CONVERSATION_COMPLETED = 'conversation_completed',
  FUNCTION_EXECUTED = 'function_executed',
  KNOWLEDGE_UPDATED = 'knowledge_updated',
  ERROR_OCCURRED = 'error_occurred',
  RESPONSE_RATED = 'response_rated'
}

export interface LearningPayload {
  conversationId?: string;
  messageId?: string;
  functionName?: string;
  rating?: number;
  feedback?: string;
  errorType?: string;
  userIntent?: string;
  actualOutcome?: string;
  expectedOutcome?: string;
  context?: Record<string, any>;
}

export interface LearningMetadata {
  aiModel: string;
  personality: string;
  expertise: string[];
  language: 'ru' | 'kk' | 'en';
  processingTime?: number;
  confidence?: number;
  sourcesUsed?: string[];
}

export interface LearningInsight {
  id: string;
  organizationId: string;
  insightType: InsightType;
  title: string;
  description: string;
  confidence: number;
  impact: InsightImpact;
  recommendations: string[];
  dataPoints: number;
  createdAt: Date;
  appliedAt?: Date;
  status: InsightStatus;
}

export enum InsightType {
  USER_PREFERENCE = 'user_preference',
  CONVERSATION_PATTERN = 'conversation_pattern',
  FUNCTION_USAGE = 'function_usage',
  KNOWLEDGE_GAP = 'knowledge_gap',
  PERFORMANCE_ISSUE = 'performance_issue',
  SUCCESS_PATTERN = 'success_pattern'
}

export enum InsightImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum InsightStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  APPLIED = 'applied',
  DISMISSED = 'dismissed'
}

export interface UserInteractionPattern {
  userId: string;
  organizationId: string;
  preferredPersonality: string;
  commonQuestions: string[];
  averageSessionLength: number;
  preferredFunctions: string[];
  successfulIntents: string[];
  problematicAreas: string[];
  satisfactionScore: number;
  updatedAt: Date;
}

export interface OrganizationLearningProfile {
  organizationId: string;
  industry: string;
  commonUseCases: string[];
  successfulPatterns: LearningPattern[];
  knowledgeGaps: string[];
  performanceMetrics: PerformanceMetrics;
  recommendations: LearningRecommendation[];
  lastAnalyzed: Date;
}

export interface LearningPattern {
  patternType: string;
  description: string;
  frequency: number;
  successRate: number;
  examples: string[];
  confidence: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  userSatisfactionScore: number;
  functionSuccessRate: number;
  knowledgeCoverage: number;
  improvementTrend: 'improving' | 'stable' | 'declining';
}

export interface LearningRecommendation {
  type: RecommendationType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  implementation: string[];
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
}

export enum RecommendationType {
  KNOWLEDGE_BASE_UPDATE = 'knowledge_base_update',
  PERSONALITY_ADJUSTMENT = 'personality_adjustment',
  FUNCTION_IMPROVEMENT = 'function_improvement',
  USER_TRAINING = 'user_training',
  SYSTEM_OPTIMIZATION = 'system_optimization'
}

// Domain Events
export class LearningEventRecordedEvent {
  constructor(
    public readonly eventId: string,
    public readonly organizationId: string,
    public readonly eventType: LearningEventType,
    public readonly userId: string
  ) {}
}

export class InsightGeneratedEvent {
  constructor(
    public readonly insightId: string,
    public readonly organizationId: string,
    public readonly insightType: InsightType,
    public readonly impact: InsightImpact,
    public readonly confidence: number
  ) {}
}

export class UserPatternUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly changes: string[]
  ) {}
}

export class PerformanceImprovedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly metric: string,
    public readonly oldValue: number,
    public readonly newValue: number,
    public readonly improvement: number
  ) {}
}