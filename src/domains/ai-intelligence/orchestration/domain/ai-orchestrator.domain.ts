// AI Orchestrator Domain Entity
// This represents the core business logic for AI Brain orchestration

export interface AiContext {
  userId: string;
  organizationId: string;
  sessionId: string;
  conversationHistory: ConversationMessage[];
  organizationData: OrganizationContext;
  userConfig: UserAiConfig;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tokens?: number;
    model?: string;
    functions?: FunctionCall[];
    sources?: KnowledgeSource[];
    confidence?: number;
    processingTime?: number;
  };
}

export interface OrganizationContext {
  name: string;
  industry: string;
  bin: string;
  knowledgeBase: KnowledgeDocument[];
  permissions: string[];
}

export interface UserAiConfig {
  assistantName: string;
  personality: 'professional' | 'friendly' | 'analytical' | 'creative' | 'supportive';
  expertise: string[];
  voicePreference: 'male' | 'female' | 'neutral';
  configuredAt: Date;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  chunks: DocumentChunk[];
  embedding?: number[];
  accessLevel: 'public' | 'confidential' | 'restricted';
}

export interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    section?: string;
    pageNumber?: number;
    source?: string;
  };
}

export interface AiRequest {
  message: string;
  context?: AiContext;
  requiresFunctionCall?: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface AiResponse {
  content: string;
  assistant: string;
  timestamp: Date;
  isRealAI: boolean;
  model: string;
  tokensUsed: number;
  provider: string;
  functions?: FunctionCall[];
  confidence?: number;
  sources?: KnowledgeSource[];
  sessionId?: string;
}

export interface FunctionCall {
  name: string;
  parameters: Record<string, any>;
  result?: any;
  executedAt?: Date;
  error?: string;
}

export interface KnowledgeSource {
  documentId: string;
  title: string;
  relevanceScore: number;
  chunkId?: string;
}

// Domain Events
export class AiRequestProcessedEvent {
  constructor(
    public readonly requestId: string,
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly response: AiResponse,
    public readonly processingTimeMs: number
  ) {}
}

export class FunctionExecutedEvent {
  constructor(
    public readonly functionName: string,
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly parameters: Record<string, any>,
    public readonly result: any,
    public readonly success: boolean
  ) {}
}