// Conversation Domain - Manages AI chat sessions and context

export interface ConversationSession {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messagesCount: number;
  metadata: ConversationMetadata;
}

export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

export interface ConversationMetadata {
  assistantName: string;
  personality: string;
  totalTokens: number;
  averageResponseTime: number;
  functionsUsed: string[];
  topics: string[];
  language: 'ru' | 'kk' | 'en';
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata: MessageMetadata;
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  processingTime?: number;
  functions?: FunctionCall[];
  sources?: KnowledgeSource[];
  confidence?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  intent?: string;
}

export interface FunctionCall {
  name: string;
  parameters: Record<string, any>;
  result?: any;
  executedAt?: Date;
  error?: string;
  success: boolean;
}

export interface KnowledgeSource {
  documentId: string;
  title: string;
  relevanceScore: number;
  chunkId?: string;
  excerpt: string;
}

export interface ConversationContext {
  sessionId: string;
  userId: string;
  organizationId: string;
  messages: ConversationMessage[];
  maxContextMessages: number;
  contextWindowTokens: number;
  currentTokens: number;
}

// Domain Events
export class ConversationStartedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly assistantName: string
  ) {}
}

export class MessageAddedEvent {
  constructor(
    public readonly messageId: string,
    public readonly sessionId: string,
    public readonly role: MessageRole,
    public readonly content: string,
    public readonly userId: string
  ) {}
}

export class ConversationEndedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly duration: number,
    public readonly messagesCount: number,
    public readonly totalTokens: number
  ) {}
}

export class ConversationArchivedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly reason: string
  ) {}
}