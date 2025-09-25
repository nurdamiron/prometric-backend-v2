import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, Organization } from '../../../user-identity-access/authentication/domain/entities/user.entity';
import {
  AiRequest,
  AiResponse,
  AiContext,
  ConversationMessage,
  UserAiConfig,
  AiRequestProcessedEvent,
  FunctionExecutedEvent
} from '../domain/ai-orchestrator.domain';

// Import RAG service for knowledge integration
import { RAGService, RAGQuery } from '../../knowledge-management/application/rag.service';
// Import Conversation service for context management
import { ConversationService } from '../../conversation/application/conversation.service';
import { MessageRole } from '../../conversation/domain/conversation.domain';

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    private readonly configService: ConfigService,
    private readonly ragService: RAGService,
    private readonly conversationService: ConversationService,
  ) {}

  async processAiRequest(userId: string, request: AiRequest, sessionId?: string): Promise<AiResponse> {
    const startTime = Date.now();

    try {
      // 1. Build AI Context (parallel optimization)
      const [context, conversationSessionId] = await Promise.all([
        this.buildAiContext(userId),
        sessionId ? Promise.resolve(sessionId) : this.createNewSession(userId)
      ]);

      // 2. Get conversation history in parallel with RAG if session exists
      let conversationHistory: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date }> = [];
      if (conversationSessionId) {
        try {
          const conversationContext = await this.conversationService.getConversationContext(conversationSessionId);
          conversationHistory = conversationContext.messages;
        } catch (error) {
          this.logger.warn(`Failed to load conversation history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      context.conversationHistory = conversationHistory;
      context.sessionId = conversationSessionId;

      // 4. Enhance request with context
      const enhancedRequest = { ...request, context };

      // 5. Process with appropriate AI model (with RAG + conversation context)
      const response = await this.executeAiRequest(enhancedRequest);

      // 6. Store conversation messages in parallel (don't block response)
      Promise.all([
        this.conversationService.addMessage(
          conversationSessionId,
          MessageRole.USER,
          request.message
        ),
        this.conversationService.addMessage(
          conversationSessionId,
          MessageRole.ASSISTANT,
          response.content,
          {
            tokens: response.tokensUsed,
            model: response.model,
            functions: response.functions,
            sources: response.sources,
            confidence: response.confidence,
            processingTime: Date.now() - startTime
          }
        )
      ]).catch(error => {
        this.logger.error('Failed to store conversation messages:', error);
      });

      // 8. Execute functions if needed
      if (response.functions && response.functions.length > 0) {
        await this.executeFunctions(response.functions, context);
      }

      // 9. Emit domain event
      const processingTime = Date.now() - startTime;
      const event = new AiRequestProcessedEvent(
        this.generateRequestId(),
        userId,
        context.organizationId,
        response,
        processingTime
      );

      this.logger.log(`AI request processed in ${processingTime}ms`, {
        userId,
        sessionId: conversationSessionId,
        model: response.model,
        tokens: response.tokensUsed,
        sourcesUsed: response.sources?.length || 0
      });

      // Add session ID to response
      return {
        ...response,
        sessionId: conversationSessionId
      };

    } catch (error) {
      this.logger.error('Failed to process AI request', error, { userId });
      throw error;
    }
  }

  async configureUserAssistant(userId: string, config: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const aiConfig = {
      ...config,
      configuredAt: new Date(),
    };

    await this.userRepository.update(userId, { aiConfig });

    return {
      success: true,
      message: 'AI Assistant configured successfully',
      config: aiConfig
    };
  }

  async configureOrganizationBrain(organizationId: string, config: any) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId }
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const aiBrain = {
      ...config,
      configuredAt: new Date(),
    };

    await this.organizationRepository.update(organizationId, { aiBrain });

    return {
      success: true,
      message: 'AI Brain configured successfully',
      config: aiBrain
    };
  }

  private async buildAiContext(userId: string): Promise<AiContext> {
    const user = await this.userRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.organizationId) {
      throw new NotFoundException('User must belong to an organization');
    }

    const organization = await this.organizationRepository.findOne({
      where: { id: user.organizationId }
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!user.aiConfig) {
      throw new Error('AI Assistant must be configured first');
    }

    return {
      userId: user.id,
      organizationId: user.organizationId,
      sessionId: this.generateSessionId(),
      conversationHistory: [], // Will be loaded by conversation service
      organizationData: {
        name: organization.name,
        industry: organization.industry,
        bin: organization.bin,
        knowledgeBase: [], // Will be loaded by knowledge service
        permissions: [] // Will be loaded by permission service
      },
      userConfig: user.aiConfig as UserAiConfig
    };
  }

  private async executeAiRequest(request: AiRequest): Promise<AiResponse> {
    try {
      const context = request.context!;

      // 🧠 STEP 1: RAG - Retrieve relevant knowledge
      const ragResults = await this.retrieveRelevantKnowledge(request.message, context);

      // 🤖 STEP 2: AI Generation with knowledge context
      const response = await this.generateAiResponseWithKnowledge(request, ragResults);

      return response;

    } catch (error: any) {
      this.logger.error('AI request failed', error);
      throw new Error(`AI request failed: ${error.message}`);
    }
  }

  private async retrieveRelevantKnowledge(query: string, context: AiContext) {
    try {
      const ragQuery: RAGQuery = {
        query,
        organizationId: context.organizationId,
        maxResults: 5,
        includeChunks: true,
        hybridSearch: true,
        accessLevel: ['public', 'confidential'] // TODO: Filter by user permissions
      };

      const results = await this.ragService.searchRelevantDocuments(ragQuery);

      this.logger.debug(`RAG retrieved ${results.length} relevant documents for query: "${query.substring(0, 50)}..."`);

      return results;

    } catch (error: any) {
      this.logger.warn(`RAG retrieval failed: ${error.message}`);
      return []; // Continue without knowledge if RAG fails
    }
  }

  private async generateAiResponseWithKnowledge(request: AiRequest, ragResults: any[]): Promise<AiResponse> {
    try {
      // Load Vertex AI credentials
      const fs = await import('fs');
      let vertexAI;

      try {
        const keyPath = './vertex-ai-key.json';
        const keyFile = fs.readFileSync(keyPath, 'utf8');
        const credentials = JSON.parse(keyFile);

        const { VertexAI } = await import('@google-cloud/vertexai');

        vertexAI = new VertexAI({
          project: credentials.project_id,
          location: 'us-central1',
          googleAuthOptions: {
            credentials: {
              client_email: credentials.client_email,
              private_key: credentials.private_key,
            }
          }
        });

      } catch (credError: any) {
        throw new Error(`Vertex AI credentials not found: ${credError.message}`);
      }

      const context = request.context!;

      // Build enhanced system prompt with RAG knowledge
      const systemPrompt = this.buildSystemPromptWithKnowledge(context, ragResults);
      const enhancedPrompt = this.buildEnhancedPrompt(request.message, ragResults);

      // Select appropriate model
      const modelName = this.selectModel(request);
      const generativeModel = vertexAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: this.getTemperatureForPersonality(context.userConfig.personality),
          topP: 0.95,
          topK: 40,
        }
      });

      const conversation = `${systemPrompt}\n\n${enhancedPrompt}`;

      // Get available functions
      const businessFunctions = this.getBusinessFunctions(context);

      // Call Gemini with enhanced context
      const result = await generativeModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: conversation }]
          }
        ],
        tools: businessFunctions.length > 0 ? [{
          functionDeclarations: businessFunctions
        }] : undefined
      });

      const candidate = result.response?.candidates?.[0];
      if (!candidate?.content?.parts?.[0]?.text) {
        throw new Error('No response received from Vertex AI');
      }

      const responseText = candidate.content.parts[0].text;

      return {
        content: responseText,
        assistant: context.userConfig.assistantName,
        timestamp: new Date(),
        isRealAI: true,
        model: modelName,
        tokensUsed: this.estimateTokenUsage(conversation + responseText),
        provider: 'vertex-ai-gemini',
        functions: [],
        confidence: 0.95,
        sources: ragResults.map(result => ({
          documentId: result.documentId,
          title: result.title,
          relevanceScore: result.relevanceScore,
          chunkId: result.chunks?.[0]?.chunkId
        }))
      };

    } catch (error: any) {
      this.logger.error('Vertex AI generation failed', error);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  private async executeFunctions(functions: any[], context: AiContext): Promise<void> {
    for (const func of functions) {
      try {
        // TODO: Implement actual function execution
        const result = await this.executeBusinessFunction(func.name, func.parameters, context);

        const event = new FunctionExecutedEvent(
          func.name,
          context.userId,
          context.organizationId,
          func.parameters,
          result,
          true
        );

        func.result = result;
        func.executedAt = new Date();

      } catch (error: any) {
        this.logger.error(`Function ${func.name} failed`, error);
        func.error = error.message;
      }
    }
  }

  private async executeBusinessFunction(name: string, parameters: any, context: AiContext): Promise<any> {
    // Real business function execution - no mocks
    switch (name) {
      case 'createContact':
        // TODO: Integrate with CRM domain service
        throw new Error('CRM service integration not yet implemented');

      case 'scheduleMeeting':
        // TODO: Integrate with calendar service
        throw new Error('Calendar service integration not yet implemented');

      case 'generateReport':
        // TODO: Integrate with analytics domain service
        throw new Error('Analytics service integration not yet implemented');

      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  private async storeConversation(context: AiContext, userMessage: string, response: AiResponse): Promise<void> {
    // TODO: Implement conversation storage
    this.logger.debug('Conversation stored', {
      userId: context.userId,
      messageLength: userMessage.length,
      responseLength: response.content.length
    });
  }

  private selectModel(request: AiRequest): string {
    const messageLength = request.message.length;
    const complexityIndicators = [
      'анализ', 'analyze', 'сравни', 'compare', 'отчет', 'report',
      'статистика', 'statistics', 'прогноз', 'forecast', 'план',
      'стратегия', 'strategy', 'calculate', 'вычисли'
    ];

    const isComplex = complexityIndicators.some(indicator =>
      request.message.toLowerCase().includes(indicator)
    );

    return (isComplex || messageLength > 200) ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
  }

  private buildSystemPrompt(context: AiContext): string {
    const { userConfig, organizationData } = context;

    return `Ты - ${userConfig.assistantName}, AI-ассистент для Казахстанской CRM системы Prometric.
Твоя специализация: ${userConfig.expertise.join(', ')}.
Компания: "${organizationData.name}" в сфере "${organizationData.industry}".

ВАЖНО:
- Отвечай на русском языке
- Учитывай казахские бизнес-реалии
- Предлагай конкретные действия в CRM
- Используй ${this.getPersonalityStyle(userConfig.personality)} стиль общения`;
  }

  private buildSystemPromptWithKnowledge(context: AiContext, ragResults: any[]): string {
    const basePrompt = this.buildSystemPrompt(context);

    // Add conversation history context
    let conversationContext = '';
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const recentMessages = context.conversationHistory.slice(-6); // Last 6 messages for context
      conversationContext = `
ИСТОРИЯ РАЗГОВОРА:
${recentMessages.map(msg => `${msg.role === 'user' ? 'Пользователь' : context.userConfig.assistantName}: ${msg.content}`).join('\n')}

ВАЖНО: Учитывай контекст предыдущих сообщений в разговоре.
`;
    }

    // Add knowledge base context
    let knowledgeContext = '';
    if (ragResults.length > 0) {
      knowledgeContext = `
ДОСТУПНАЯ БАЗА ЗНАНИЙ:
Я имею доступ к следующей информации о компании "${context.organizationData.name}":

${ragResults.map((result, index) => `
${index + 1}. ${result.title} (релевантность: ${Math.round(result.relevanceScore * 100)}%)
Содержание: ${result.content.substring(0, 300)}...
${result.chunks && result.chunks.length > 0 ? `
Ключевые фрагменты:
${result.chunks.map((chunk: any) => `- ${chunk.content.substring(0, 150)}...`).join('\n')}` : ''}
`).join('\n')}

ИНСТРУКЦИИ ПО ИСПОЛЬЗОВАНИЮ БАЗЫ ЗНАНИЙ:
- Используй эту информацию для более точных и релевантных ответов
- Ссылайся на конкретные документы когда это уместно
- Если информации недостаточно, честно скажи об этом
- Всегда проверяй релевантность информации к вопросу пользователя`;
    }

    return `${basePrompt}${conversationContext}${knowledgeContext}`;
  }

  private buildEnhancedPrompt(userMessage: string, ragResults: any[]): string {
    if (ragResults.length === 0) {
      return `Пользователь: ${userMessage}\n\nОтвет:`;
    }

    return `КОНТЕКСТ: У меня есть ${ragResults.length} релевантных документов из базы знаний компании для этого вопроса.

Пользователь: ${userMessage}

ЗАДАЧА: Ответь на вопрос пользователя, используя информацию из базы знаний когда это уместно. Если база знаний содержит релевантную информацию - обязательно используй её. Если нет - ответь основываясь на общих знаниях о CRM и бизнес-процессах.

Ответ:`;
  }

  private getPersonalityStyle(personality: string): string {
    const styles = {
      professional: 'деловой',
      friendly: 'дружелюбный',
      analytical: 'аналитический',
      creative: 'креативный',
      supportive: 'поддерживающий'
    };
    return styles[personality as keyof typeof styles] || 'профессиональный';
  }

  private getTemperatureForPersonality(personality: string): number {
    const temperatures = {
      professional: 0.3,
      friendly: 0.7,
      analytical: 0.2,
      creative: 0.9,
      supportive: 0.6
    };
    return temperatures[personality as keyof typeof temperatures] || 0.5;
  }

  private getBusinessFunctions(context: AiContext): any[] {
    // TODO: Load functions based on user permissions and organization modules
    return [
      {
        name: 'createContact',
        description: 'Создать новый контакт в CRM',
        parameters: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' }
          },
          required: ['firstName', 'lastName']
        }
      }
    ];
  }

  private estimateTokenUsage(text: string): number {
    return Math.ceil(text.split(/\s+/).length / 0.75);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async createNewSession(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.organizationId || !user.aiConfig) {
      throw new Error('User not properly configured for AI sessions');
    }

    const session = await this.conversationService.startConversation(
      userId,
      user.organizationId,
      user.aiConfig.assistantName,
      `Разговор с ${user.aiConfig.assistantName}`
    );

    return session.id;
  }
}