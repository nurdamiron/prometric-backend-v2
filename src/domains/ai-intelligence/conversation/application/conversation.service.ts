import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConversationSessionEntity,
  ConversationMessageEntity
} from '../infrastructure/persistence/conversation.entity';
import {
  ConversationSession,
  ConversationMessage,
  ConversationContext,
  ConversationStatus,
  MessageRole,
  ConversationStartedEvent,
  MessageAddedEvent,
  ConversationEndedEvent
} from '../domain/conversation.domain';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly MAX_CONTEXT_MESSAGES = 20;
  private readonly MAX_CONTEXT_TOKENS = 8000;

  constructor(
    @InjectRepository(ConversationSessionEntity)
    private readonly sessionRepository: Repository<ConversationSessionEntity>,

    @InjectRepository(ConversationMessageEntity)
    private readonly messageRepository: Repository<ConversationMessageEntity>
  ) {}

  async startConversation(
    userId: string,
    organizationId: string,
    assistantName: string,
    title?: string
  ): Promise<ConversationSession> {
    const session = this.sessionRepository.create({
      userId,
      organizationId,
      title: title || `Разговор с ${assistantName}`,
      status: ConversationStatus.ACTIVE,
      lastMessageAt: new Date(),
      messagesCount: 0,
      metadata: {
        assistantName,
        personality: 'professional', // Default
        totalTokens: 0,
        averageResponseTime: 0,
        functionsUsed: [],
        topics: [],
        language: 'ru'
      }
    });

    const saved = await this.sessionRepository.save(session);

    // Emit domain event
    const event = new ConversationStartedEvent(
      saved.id,
      userId,
      organizationId,
      assistantName
    );

    this.logger.log(`Conversation started: ${saved.id}`, { userId, assistantName });

    return this.mapEntityToDomain(saved);
  }

  async addMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    metadata?: any
  ): Promise<ConversationMessage> {
    // Verify session exists
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId }
    });

    if (!session) {
      throw new NotFoundException(`Conversation session ${sessionId} not found`);
    }

    // Create message
    const message = this.messageRepository.create({
      sessionId,
      role,
      content,
      timestamp: new Date(),
      metadata
    });

    const saved = await this.messageRepository.save(message);

    // Update session
    await this.sessionRepository.update(sessionId, {
      lastMessageAt: new Date(),
      messagesCount: session.messagesCount + 1,
      metadata: {
        ...session.metadata,
        totalTokens: (session.metadata?.totalTokens || 0) + (metadata?.tokens || 0)
      }
    });

    // Emit domain event
    const event = new MessageAddedEvent(
      saved.id,
      sessionId,
      role,
      content,
      session.userId
    );

    this.logger.debug(`Message added to conversation ${sessionId}`, {
      role,
      contentLength: content.length,
      tokens: metadata?.tokens
    });

    return this.mapMessageEntityToDomain(saved);
  }

  async getConversationContext(sessionId: string): Promise<ConversationContext> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId }
    });

    if (!session) {
      throw new NotFoundException(`Conversation session ${sessionId} not found`);
    }

    // Get recent messages for context
    const messages = await this.messageRepository.find({
      where: { sessionId },
      order: { timestamp: 'DESC' },
      take: this.MAX_CONTEXT_MESSAGES
    });

    // Calculate current token usage
    const currentTokens = messages.reduce(
      (sum, msg) => sum + (msg.metadata?.tokens || 0),
      0
    );

    return {
      sessionId,
      userId: session.userId,
      organizationId: session.organizationId,
      messages: messages.reverse().map(this.mapMessageEntityToDomain), // Oldest first
      maxContextMessages: this.MAX_CONTEXT_MESSAGES,
      contextWindowTokens: this.MAX_CONTEXT_TOKENS,
      currentTokens
    };
  }

  async getUserConversations(
    userId: string,
    limit: number = 10,
    status?: ConversationStatus
  ): Promise<ConversationSession[]> {
    const queryBuilder = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.userId = :userId', { userId })
      .orderBy('session.lastMessageAt', 'DESC')
      .take(limit);

    if (status) {
      queryBuilder.andWhere('session.status = :status', { status });
    }

    const sessions = await queryBuilder.getMany();

    return sessions.map(this.mapEntityToDomain);
  }

  async getConversationHistory(
    sessionId: string,
    limit?: number,
    offset?: number
  ): Promise<ConversationMessage[]> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.sessionId = :sessionId', { sessionId })
      .orderBy('message.timestamp', 'ASC');

    if (limit) {
      queryBuilder.take(limit);
    }

    if (offset) {
      queryBuilder.skip(offset);
    }

    const messages = await queryBuilder.getMany();

    return messages.map(this.mapMessageEntityToDomain);
  }

  async archiveConversation(sessionId: string, reason?: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId }
    });

    if (!session) {
      throw new NotFoundException(`Conversation session ${sessionId} not found`);
    }

    await this.sessionRepository.update(sessionId, {
      status: ConversationStatus.ARCHIVED
    });

    this.logger.log(`Conversation archived: ${sessionId}`, { reason });
  }

  async deleteConversation(sessionId: string): Promise<void> {
    // Soft delete - mark as deleted but keep data
    await this.sessionRepository.update(sessionId, {
      status: ConversationStatus.DELETED
    });

    this.logger.log(`Conversation deleted: ${sessionId}`);
  }

  async getConversationStats(organizationId: string): Promise<{
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    totalTokensUsed: number;
    mostUsedFunctions: string[];
  }> {
    const [totalConversations] = await this.sessionRepository
      .createQueryBuilder('session')
      .select('COUNT(*)', 'count')
      .where('session.organizationId = :organizationId', { organizationId })
      .getRawOne();

    const [activeConversations] = await this.sessionRepository
      .createQueryBuilder('session')
      .select('COUNT(*)', 'count')
      .where('session.organizationId = :organizationId', { organizationId })
      .andWhere('session.status = :status', { status: ConversationStatus.ACTIVE })
      .getRawOne();

    const [totalMessages] = await this.messageRepository
      .createQueryBuilder('message')
      .innerJoin('ai_conversation_sessions', 'session', 'session.id = message.sessionId')
      .select('COUNT(*)', 'count')
      .where('session.organizationId = :organizationId', { organizationId })
      .getRawOne();

    // Calculate stats
    const avgMessages = totalConversations > 0
      ? Math.round(totalMessages / totalConversations)
      : 0;

    // Get total tokens and functions used
    const sessions = await this.sessionRepository.find({
      where: { organizationId }
    });

    const totalTokensUsed = sessions.reduce(
      (sum, session) => sum + (session.metadata?.totalTokens || 0),
      0
    );

    const allFunctions = sessions.flatMap(
      session => session.metadata?.functionsUsed || []
    );

    const functionCounts = allFunctions.reduce((acc, func) => {
      acc[func] = (acc[func] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsedFunctions = Object.entries(functionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);

    return {
      totalConversations: parseInt(totalConversations),
      activeConversations: parseInt(activeConversations),
      totalMessages: parseInt(totalMessages),
      averageMessagesPerConversation: avgMessages,
      totalTokensUsed,
      mostUsedFunctions
    };
  }

  private mapEntityToDomain(entity: ConversationSessionEntity): ConversationSession {
    return {
      id: entity.id,
      userId: entity.userId,
      organizationId: entity.organizationId,
      title: entity.title,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      lastMessageAt: entity.lastMessageAt,
      messagesCount: entity.messagesCount,
      metadata: entity.metadata
    };
  }

  private mapMessageEntityToDomain = (entity: ConversationMessageEntity): ConversationMessage => {
    return {
      id: entity.id,
      sessionId: entity.sessionId,
      role: entity.role as MessageRole,
      content: entity.content,
      timestamp: entity.timestamp,
      metadata: entity.metadata
    };
  }
}