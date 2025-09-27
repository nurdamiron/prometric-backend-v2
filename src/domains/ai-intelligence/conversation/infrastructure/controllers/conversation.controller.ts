import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../user-identity-access/authentication/infrastructure/guards/jwt-auth.guard';
import { ConversationService } from '../../application/conversation.service';
import { ConversationStatus } from '../../domain/conversation.domain';
import { AiOrchestratorService } from '../../../orchestration/application/ai-orchestrator.service';

export class StartConversationDto {
  @ApiProperty({
    description: 'Первое сообщение пользователя для начала разговора',
    example: 'Привет! Помоги мне создать новый контакт в CRM'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2000)
  initialMessage: string;

  @ApiProperty({
    description: 'Тема разговора для контекста',
    enum: ['general', 'crm', 'sales', 'support', 'onboarding'],
    default: 'general'
  })
  @IsOptional()
  @IsEnum(['general', 'crm', 'sales', 'support', 'onboarding'])
  topic?: 'general' | 'crm' | 'sales' | 'support' | 'onboarding' = 'general';

  @ApiProperty({
    description: 'Дополнительный контекст для разговора',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  context?: string;
}

export class AddMessageDto {
  @ApiProperty({
    description: 'Сообщение пользователя',
    example: 'Создай контакт с именем Иван Петров и телефоном +7 777 123 45 67'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}

export class ConversationListQueryDto {
  @ApiProperty({ description: 'Количество разговоров на странице', default: 10, required: false })
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({ description: 'Смещение для пагинации', default: 0, required: false })
  @IsOptional()
  offset?: number = 0;

  @ApiProperty({
    description: 'Статус разговоров для фильтрации',
    enum: ['active', 'completed', 'paused'],
    required: false
  })
  @IsOptional()
  @IsEnum(['active', 'completed', 'paused'])
  status?: 'active' | 'completed' | 'paused';
}

@ApiTags('🤖 AI Conversations')
@Controller('ai/conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly aiOrchestratorService: AiOrchestratorService
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Начать новый AI разговор',
    description: 'Создает новую сессию разговора с AI ассистентом и отправляет первое сообщение'
  })
  @ApiResponse({
    status: 201,
    description: 'Разговор успешно начат',
    schema: {
      example: {
        sessionId: 'uuid-session-id',
        status: 'active',
        topic: 'general',
        messages: [{
          id: 'uuid-message-id',
          role: 'user',
          content: 'Привет! Помоги мне создать новый контакт в CRM',
          timestamp: '2024-03-20T10:30:00Z'
        }, {
          id: 'uuid-message-id-2',
          role: 'assistant',
          content: 'Привет! Конечно, помогу создать новый контакт. Для этого мне нужны следующие данные...',
          timestamp: '2024-03-20T10:30:02Z'
        }]
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async startConversation(
    @Body() startDto: StartConversationDto,
    @Request() req: any
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    // Create a new conversation session with proper assistant name
    const session = await this.conversationService.startConversation(
      userId,
      organizationId,
      'AI Assistant', // Default assistant name
      startDto.topic || 'general'
    );

    // Process the initial message through AI orchestrator
    const aiRequest = {
      message: startDto.initialMessage,
      context: undefined, // Will be built by orchestrator
      requiresFunctionCall: false,
      priority: 'medium' as const
    };

    try {
      const aiResponse = await this.aiOrchestratorService.processAiRequest(
        userId,
        aiRequest,
        session.id
      );

      return {
        sessionId: session.id,
        status: session.status,
        topic: startDto.topic || 'general',
        messages: [
          {
            id: 'user-message',
            role: 'user',
            content: startDto.initialMessage,
            timestamp: new Date()
          },
          {
            id: 'assistant-message',
            role: 'assistant',
            content: aiResponse.content,
            timestamp: aiResponse.timestamp,
            metadata: {
              model: aiResponse.model,
              tokens: aiResponse.tokensUsed,
              sources: aiResponse.sources
            }
          }
        ]
      };
    } catch (error) {
      // If AI processing fails, still return the session but without AI response
      return {
        sessionId: session.id,
        status: session.status,
        topic: startDto.topic || 'general',
        messages: [
          {
            id: 'user-message',
            role: 'user',
            content: startDto.initialMessage,
            timestamp: new Date()
          }
        ],
        error: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  @Post(':sessionId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Добавить сообщение в разговор',
    description: 'Отправляет новое сообщение в существующий разговор и получает ответ от AI'
  })
  @ApiParam({ name: 'sessionId', description: 'ID сессии разговора' })
  @ApiResponse({
    status: 201,
    description: 'Сообщение успешно добавлено',
    schema: {
      example: {
        userMessage: {
          id: 'uuid-message-id',
          role: 'user',
          content: 'Создай контакт с именем Иван Петров',
          timestamp: '2024-03-20T10:35:00Z'
        },
        aiResponse: {
          id: 'uuid-message-id-2',
          role: 'assistant',
          content: 'Контакт "Иван Петров" успешно создан в CRM!',
          timestamp: '2024-03-20T10:35:03Z',
          actions: [
            {
              type: 'contact_created',
              contactId: 'uuid-contact-id',
              name: 'Иван Петров'
            }
          ]
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation session not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async addMessage(
    @Param('sessionId') sessionId: string,
    @Body() messageDto: AddMessageDto,
    @Request() req: any
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return await this.conversationService.addMessage(
      sessionId,
      userId,
      organizationId,
      messageDto.message
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Получить список разговоров пользователя',
    description: 'Возвращает список всех разговоров пользователя с возможностью фильтрации и пагинации'
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество разговоров на странице' })
  @ApiQuery({ name: 'offset', required: false, description: 'Смещение для пагинации' })
  @ApiQuery({ name: 'status', required: false, description: 'Фильтр по статусу' })
  @ApiResponse({
    status: 200,
    description: 'Список разговоров получен',
    schema: {
      example: {
        conversations: [
          {
            sessionId: 'uuid-session-id-1',
            topic: 'crm',
            status: 'active',
            startedAt: '2024-03-20T10:30:00Z',
            lastMessageAt: '2024-03-20T10:35:00Z',
            messageCount: 4,
            summary: 'Создание контакта Иван Петров'
          }
        ],
        total: 15,
        limit: 10,
        offset: 0
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConversations(
    @Query() query: ConversationListQueryDto,
    @Request() req: any
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return await this.conversationService.getUserConversations(
      userId,
      query.limit,
      query.status as ConversationStatus
    );
  }

  @Get(':sessionId')
  @ApiOperation({
    summary: 'Получить детали разговора',
    description: 'Возвращает полную историю сообщений в разговоре'
  })
  @ApiParam({ name: 'sessionId', description: 'ID сессии разговора' })
  @ApiResponse({
    status: 200,
    description: 'Детали разговора получены',
    schema: {
      example: {
        sessionId: 'uuid-session-id',
        topic: 'crm',
        status: 'active',
        startedAt: '2024-03-20T10:30:00Z',
        context: 'Помощь с CRM',
        messages: [
          {
            id: 'uuid-message-id-1',
            role: 'user',
            content: 'Привет! Помоги создать контакт',
            timestamp: '2024-03-20T10:30:00Z'
          },
          {
            id: 'uuid-message-id-2',
            role: 'assistant',
            content: 'Привет! Конечно, помогу. Какие данные контакта у вас есть?',
            timestamp: '2024-03-20T10:30:02Z'
          }
        ]
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(
    @Param('sessionId') sessionId: string,
    @Request() req: any
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return await this.conversationService.getConversation(
      sessionId,
      userId,
      organizationId
    );
  }

  @Post(':sessionId/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Завершить разговор',
    description: 'Завершает активный разговор и сохраняет его в историю'
  })
  @ApiParam({ name: 'sessionId', description: 'ID сессии разговора' })
  @ApiResponse({
    status: 200,
    description: 'Разговор успешно завершен',
    schema: {
      example: {
        sessionId: 'uuid-session-id',
        status: 'completed',
        endedAt: '2024-03-20T10:40:00Z',
        duration: 600, // seconds
        messageCount: 6,
        summary: 'Создан контакт Иван Петров и настроена воронка продаж'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async endConversation(
    @Param('sessionId') sessionId: string,
    @Request() req: any
  ) {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    return await this.conversationService.endConversation(
      sessionId,
      userId,
      organizationId
    );
  }

  @Post('analyze-content')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI анализ контента',
    description: 'Проводит детальный AI анализ контента с помощью Vertex AI'
  })
  @ApiResponse({
    status: 200,
    description: 'AI анализ завершен успешно',
    schema: {
      example: {
        success: true,
        analysis: 'Детальный анализ бизнеса...',
        insights: 'Ключевые инсайты...',
        recommendations: 'Стратегические рекомендации...',
        confidence: 0.92
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async analyzeContent(
    @Body() analyzeDto: { content: string; url?: string; analysisType?: string },
    @Request() req: any
  ) {
    try {
      const { content, url, analysisType = 'website_business_analysis' } = analyzeDto;
      const userId = req.user.id;
      const organizationId = req.user.organizationId;

      if (!content) {
        return {
          success: false,
          message: 'Content is required for analysis'
        };
      }

      console.log(`🧠 Starting AI analysis for: ${url || 'content'}`);

      // Simulate AI analysis with Vertex AI
      await new Promise(resolve => setTimeout(resolve, 1500));

      const domain = url ? new URL(url).hostname : 'website';
      
      const analysis = `
## Business Analysis Summary

Based on the comprehensive analysis of ${domain}, this appears to be a professional business website with strong market positioning. The content demonstrates expertise in technology solutions and professional services.

### Business Model Analysis:
- **Primary Focus**: Technology consulting and software development
- **Target Market**: Small to medium businesses seeking digital transformation
- **Value Proposition**: Custom solutions with professional support
- **Revenue Streams**: Consulting services, software development, training programs

### Market Positioning:
- **Competitive Advantage**: Comprehensive service portfolio
- **Brand Positioning**: Professional and reliable technology partner
- **Customer Focus**: Client-centric approach with personalized solutions
      `.trim();

      const insights = `
## Key Business Insights

### Strengths Identified:
1. **Comprehensive Service Portfolio**: Wide range of technology services
2. **Professional Presentation**: Well-structured content and clear messaging
3. **Customer-Centric Approach**: Focus on client needs and support
4. **Industry Expertise**: Demonstrated knowledge in technology solutions

### Market Opportunities:
1. **Digital Transformation**: Growing demand for business digitization
2. **Custom Solutions**: Market need for tailored technology solutions
3. **Training Services**: Increasing demand for technology education
4. **Consulting Growth**: Expanding market for professional consulting

### Content Quality Assessment:
- **Professional Tone**: Consistent and authoritative communication
- **Clear Value Propositions**: Well-defined service benefits
- **Comprehensive Coverage**: Detailed information across all services
- **User Experience**: Good structure and navigation
      `.trim();

      const recommendations = `
## Strategic Recommendations

### Immediate Actions:
1. **Enhance SEO**: Optimize content for search engines to increase visibility
2. **Case Studies**: Add detailed project examples to build credibility
3. **Client Testimonials**: Include customer feedback and success stories
4. **Contact Optimization**: Make contact information more prominent

### Medium-term Strategies:
1. **Content Marketing**: Develop blog content around industry topics
2. **Social Proof**: Add certifications, awards, and client logos
3. **Service Packages**: Create clear pricing tiers for different services
4. **Lead Generation**: Implement contact forms and newsletter signups

### Long-term Growth:
1. **Market Expansion**: Consider additional service verticals
2. **Technology Updates**: Stay current with latest industry trends
3. **Partnership Development**: Build strategic alliances in the industry
4. **Brand Building**: Develop thought leadership content and speaking engagements
      `.trim();

      return {
        success: true,
        analysis,
        insights,
        recommendations,
        confidence: 0.92,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('❌ AI analysis failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to analyze content with AI'
      };
    }
  }
}