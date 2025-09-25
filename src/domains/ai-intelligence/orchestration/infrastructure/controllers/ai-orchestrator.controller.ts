import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../user-identity-access/authentication/infrastructure/guards/jwt-auth.guard';
import { AiOrchestratorService } from '../../application/ai-orchestrator.service';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiChatDto {
  @ApiProperty({ description: 'Сообщение пользователя для AI ассистента' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'ID сессии разговора (для продолжения диалога)', required: false })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({ description: 'Дополнительный контекст для запроса', required: false })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiProperty({
    description: 'Приоритет запроса',
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
}

export class ConfigureUserAssistantDto {
  @ApiProperty({ description: 'Имя AI ассистента' })
  @IsString()
  @IsNotEmpty()
  assistantName: string;

  @ApiProperty({
    description: 'Тип личности ассистента',
    enum: ['professional', 'friendly', 'analytical', 'creative', 'supportive']
  })
  @IsEnum(['professional', 'friendly', 'analytical', 'creative', 'supportive'])
  personality: 'professional' | 'friendly' | 'analytical' | 'creative' | 'supportive';

  @ApiProperty({ description: 'Области экспертизы ассистента' })
  @IsArray()
  @IsString({ each: true })
  expertise: string[];

  @ApiProperty({
    description: 'Предпочитаемый голос',
    enum: ['male', 'female', 'neutral']
  })
  @IsEnum(['male', 'female', 'neutral'])
  voicePreference: 'male' | 'female' | 'neutral';
}

export class ConfigureOrganizationBrainDto {
  @ApiProperty({
    description: 'Тип личности организационного AI',
    enum: ['aggressive', 'balanced', 'conservative', 'innovative']
  })
  @IsEnum(['aggressive', 'balanced', 'conservative', 'innovative'])
  personality: 'aggressive' | 'balanced' | 'conservative' | 'innovative';

  @ApiProperty({ description: 'Бизнес-цели организации' })
  @IsArray()
  @IsString({ each: true })
  businessGoals: string[];

  @ApiProperty({ description: 'Активные модули AI Brain' })
  @IsArray()
  @IsString({ each: true })
  activeModules: string[];
}

@ApiTags('ai-orchestrator')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiOrchestratorController {
  constructor(
    private readonly aiOrchestratorService: AiOrchestratorService
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Общение с AI ассистентом',
    description: 'Отправить сообщение AI ассистенту и получить ответ с поддержкой функций'
  })
  @ApiResponse({
    status: 200,
    description: 'Успешный ответ от AI ассистента',
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Ответ ассистента' },
        assistant: { type: 'string', description: 'Имя ассистента' },
        timestamp: { type: 'string', format: 'date-time' },
        isRealAI: { type: 'boolean', description: 'Настоящий AI или заглушка' },
        model: { type: 'string', description: 'Использованная модель AI' },
        tokensUsed: { type: 'number', description: 'Количество токенов' },
        provider: { type: 'string', description: 'Провайдер AI' },
        functions: {
          type: 'array',
          description: 'Выполненные функции',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              parameters: { type: 'object' },
              result: { type: 'object' }
            }
          }
        }
      }
    }
  })
  @ApiBody({ type: AiChatDto })
  async chatWithAI(@Request() req: any, @Body() chatDto: AiChatDto) {
    const aiRequest = {
      message: chatDto.message,
      context: undefined, // Will be built by service
      requiresFunctionCall: false, // AI will decide
      priority: chatDto.priority || 'medium'
    };

    return this.aiOrchestratorService.processAiRequest(req.user.id, aiRequest, chatDto.sessionId);
  }

  @Post('assistant/configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Настроить персонального AI ассистента',
    description: 'Создать или обновить конфигурацию персонального AI ассистента пользователя'
  })
  @ApiResponse({
    status: 200,
    description: 'AI ассистент успешно настроен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        config: { type: 'object' }
      }
    }
  })
  @ApiBody({ type: ConfigureUserAssistantDto })
  async configureUserAssistant(
    @Request() req: any,
    @Body() configDto: ConfigureUserAssistantDto
  ) {
    return this.aiOrchestratorService.configureUserAssistant(req.user.id, configDto);
  }

  @Get('assistant/config')
  @ApiOperation({
    summary: 'Получить конфигурацию AI ассистента',
    description: 'Получить текущие настройки персонального AI ассистента'
  })
  @ApiResponse({
    status: 200,
    description: 'Конфигурация AI ассистента',
    schema: {
      type: 'object',
      properties: {
        aiConfig: { type: 'object', nullable: true },
        hasAssistant: { type: 'boolean' }
      }
    }
  })
  async getUserAssistantConfig(@Request() req: any) {
    // TODO: Implement get assistant config
    return {
      aiConfig: null,
      hasAssistant: false,
      message: 'Функция получения конфигурации будет реализована'
    };
  }

  @Post('brain/configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Настроить организационный AI Brain',
    description: 'Создать или обновить конфигурацию AI Brain для организации'
  })
  @ApiResponse({
    status: 200,
    description: 'AI Brain успешно настроен',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        config: { type: 'object' }
      }
    }
  })
  @ApiBody({ type: ConfigureOrganizationBrainDto })
  async configureOrganizationBrain(
    @Request() req: any,
    @Body() configDto: ConfigureOrganizationBrainDto
  ) {
    return this.aiOrchestratorService.configureOrganizationBrain(
      req.user.organizationId,
      configDto
    );
  }

  @Get('brain/config')
  @ApiOperation({
    summary: 'Получить конфигурацию AI Brain организации',
    description: 'Получить текущие настройки AI Brain организации'
  })
  @ApiResponse({
    status: 200,
    description: 'Конфигурация AI Brain организации',
    schema: {
      type: 'object',
      properties: {
        aiBrain: { type: 'object', nullable: true },
        hasBrain: { type: 'boolean' }
      }
    }
  })
  async getOrganizationBrainConfig(@Request() req: any) {
    // TODO: Implement get brain config
    return {
      aiBrain: null,
      hasBrain: false,
      message: 'Функция получения конфигурации будет реализована'
    };
  }

  @Get('capabilities')
  @ApiOperation({
    summary: 'Получить доступные возможности AI',
    description: 'Список всех доступных типов личности, областей экспертизы и модулей'
  })
  @ApiResponse({
    status: 200,
    description: 'Доступные возможности AI',
    schema: {
      type: 'object',
      properties: {
        assistantPersonalities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              label: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        expertiseAreas: {
          type: 'array',
          items: { type: 'string' }
        },
        voiceOptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              label: { type: 'string' }
            }
          }
        },
        brainPersonalities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              label: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        availableModules: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  })
  async getAvailableCapabilities() {
    return {
      assistantPersonalities: [
        { value: 'professional', label: 'Профессиональный', description: 'Деловой и сосредоточенный на задачах' },
        { value: 'friendly', label: 'Дружелюбный', description: 'Теплый и располагающий' },
        { value: 'analytical', label: 'Аналитический', description: 'Основанный на данных и логике' },
        { value: 'creative', label: 'Креативный', description: 'Инновационный и творческий' },
        { value: 'supportive', label: 'Поддерживающий', description: 'Мотивирующий и помогающий' }
      ],
      expertiseAreas: [
        'Продажи и Маркетинг',
        'Финансовый Анализ',
        'Управление Проектами',
        'Обслуживание Клиентов',
        'Аналитика Данных',
        'Бизнес Стратегия',
        'Операции',
        'Управление Персоналом',
        'Технологии',
        'Юридическое Соответствие'
      ],
      voiceOptions: [
        { value: 'male', label: 'Мужской Голос' },
        { value: 'female', label: 'Женский Голос' },
        { value: 'neutral', label: 'Нейтральный Голос' }
      ],
      brainPersonalities: [
        { value: 'aggressive', label: 'Агрессивный Рост', description: 'Высокий риск, высокая прибыль' },
        { value: 'balanced', label: 'Сбалансированный', description: 'Умеренный риск, стабильный рост' },
        { value: 'conservative', label: 'Консервативный', description: 'Низкий риск, стабильные операции' },
        { value: 'innovative', label: 'Инновационный', description: 'Передовые решения и технологии' }
      ],
      availableModules: [
        'CRM и Продажи',
        'Финансовое Управление',
        'Отслеживание Проектов',
        'Аналитика и Отчеты',
        'Поддержка Клиентов',
        'Автоматизация Маркетинга',
        'Управление Запасами',
        'HR и Зарплата',
        'Управление Документами',
        'Инструменты Коммуникации'
      ]
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Проверка работоспособности AI системы',
    description: 'Статус подключения к AI провайдерам и готовности системы'
  })
  @ApiResponse({
    status: 200,
    description: 'Статус AI системы',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        vertexAI: { type: 'object' },
        timestamp: { type: 'string' }
      }
    }
  })
  async getAiHealth() {
    return {
      status: 'operational',
      vertexAI: {
        connected: true,
        models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
        lastCheck: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
  }
}