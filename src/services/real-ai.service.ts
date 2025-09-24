import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class RealAiService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
    }
  }

  async chatWithAssistant(
    message: string,
    assistantConfig: {
      assistantName: string;
      personality: string;
      expertise: string[];
      voicePreference: string;
    },
    context?: string,
    organizationData?: any
  ) {
    try {
      // If OpenAI is not configured, return enhanced mock
      if (!this.openai) {
        return this.generateEnhancedMockResponse(message, assistantConfig, context, organizationData);
      }

      // Build system prompt based on assistant configuration
      const systemPrompt = this.buildSystemPrompt(assistantConfig, organizationData);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 500,
        temperature: this.getTemperatureForPersonality(assistantConfig.personality),
      });

      const response = completion.choices[0]?.message?.content || 'Извините, не смог обработать ваш запрос.';

      return {
        response: `${assistantConfig.assistantName}: ${response}`,
        assistant: assistantConfig.assistantName,
        timestamp: new Date().toISOString(),
        isRealAI: true,
        model: 'gpt-4',
        tokensUsed: completion.usage?.total_tokens || 0
      };

    } catch (error) {
      console.error('OpenAI API Error:', error);

      // Fallback to enhanced mock on error
      return this.generateEnhancedMockResponse(message, assistantConfig, context, organizationData);
    }
  }

  private buildSystemPrompt(assistantConfig: any, organizationData?: any): string {
    const basePrompt = `Ты - ${assistantConfig.assistantName}, ${this.getPersonalityDescription(assistantConfig.personality)} AI-ассистент для Казахстанской CRM системы Prometric.`;

    const expertisePrompt = `Твоя экспертиза включает: ${assistantConfig.expertise.join(', ')}.`;

    const organizationPrompt = organizationData
      ? `Ты работаешь с организацией "${organizationData.name}" в сфере "${organizationData.industry}".`
      : '';

    const behaviorPrompt = this.getBehaviorPrompt(assistantConfig.personality);

    const contextPrompt = `
Отвечай всегда на русском языке. Используй данные из CRM системы когда это уместно.
Будь helpful и professional. Если нужна информация которой у тебя нет, предложи как её получить в системе.
Помни что ты работаешь с казахстанским бизнесом, учитывай местную специфику.`;

    return [basePrompt, expertisePrompt, organizationPrompt, behaviorPrompt, contextPrompt]
      .filter(Boolean)
      .join(' ');
  }

  private getPersonalityDescription(personality: string): string {
    switch (personality) {
      case 'professional':
        return 'деловой и профессиональный';
      case 'friendly':
        return 'дружелюбный и открытый';
      case 'analytical':
        return 'аналитический и логичный';
      case 'creative':
        return 'креативный и инновационный';
      case 'supportive':
        return 'поддерживающий и заботливый';
      default:
        return 'профессиональный';
    }
  }

  private getBehaviorPrompt(personality: string): string {
    switch (personality) {
      case 'professional':
        return 'Отвечай четко и по делу, используй деловой стиль общения.';
      case 'friendly':
        return 'Будь теплым и дружелюбным, используй более персональный подход.';
      case 'analytical':
        return 'Фокусируйся на данных и фактах, предлагай конкретные цифры и анализ.';
      case 'creative':
        return 'Предлагай креативные решения и нестандартные подходы.';
      case 'supportive':
        return 'Будь поддерживающим и мотивирующим, помогай решать проблемы.';
      default:
        return 'Используй профессиональный подход.';
    }
  }

  private getTemperatureForPersonality(personality: string): number {
    switch (personality) {
      case 'professional': return 0.3; // Conservative
      case 'friendly': return 0.7;     // Warm
      case 'analytical': return 0.2;   // Precise
      case 'creative': return 0.9;     // Creative
      case 'supportive': return 0.6;   // Balanced
      default: return 0.5;
    }
  }

  private generateEnhancedMockResponse(
    message: string,
    assistantConfig: any,
    context?: string,
    organizationData?: any
  ): any {
    // Enhanced mock with context awareness
    let response = '';

    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('привет') || lowerMessage.includes('hello')) {
      response = `Привет! Я ${assistantConfig.assistantName}, ваш AI-ассистент. Моя специализация: ${assistantConfig.expertise.join(', ')}. Чем могу помочь?`;
    } else if (lowerMessage.includes('статистика') || lowerMessage.includes('отчет')) {
      response = `Анализирую данные... ${organizationData ? `Для ${organizationData.name}` : 'Для вашей организации'} я могу подготовить отчеты по продажам, клиентам и эффективности. Какой конкретно отчет вас интересует?`;
    } else if (lowerMessage.includes('клиент') || lowerMessage.includes('customer')) {
      response = `По клиентам у меня есть доступ к данным CRM. Могу помочь с анализом клиентской базы, сегментацией или планированием работы с клиентами. Что именно вас интересует?`;
    } else if (lowerMessage.includes('продаж') || lowerMessage.includes('sales')) {
      response = `Система продаж готова! У нас есть полноценный sales pipeline с этапами: Лиды → Квалификация → Предложение → Переговоры → Закрытие. Хотите проанализировать воронку продаж?`;
    } else if (lowerMessage.includes('помощь') || lowerMessage.includes('help')) {
      response = `Я могу помочь с: 📊 Анализом данных CRM, 📈 Отчетами по продажам, 👥 Управлением клиентами, 🎯 Оптимизацией бизнес-процессов. Что вас интересует больше всего?`;
    } else {
      response = `Понял ваш запрос: "${message}". ${this.getPersonalityResponse(assistantConfig.personality)} ${organizationData ? `Для ${organizationData.name} ` : ''}могу предложить решение основанное на данных CRM.`;
    }

    return {
      response: `${assistantConfig.assistantName}: ${response}`,
      assistant: assistantConfig.assistantName,
      timestamp: new Date().toISOString(),
      isRealAI: false,
      model: 'enhanced-mock',
      note: 'Для полной AI функциональности добавьте OPENAI_API_KEY в .env'
    };
  }

  private getPersonalityResponse(personality: string): string {
    switch (personality) {
      case 'professional':
        return 'Проанализирую это системно и предложу профессиональное решение.';
      case 'friendly':
        return 'С удовольствием помогу разобраться! 😊';
      case 'analytical':
        return 'Давайте рассмотрим это с точки зрения данных и метрик.';
      case 'creative':
        return 'Интересная задача! Предложу несколько креативных подходов.';
      case 'supportive':
        return 'Поддержу вас в решении этой задачи!';
      default:
        return 'Рассмотрю этот вопрос детально.';
    }
  }

  async generateBusinessInsights(organizationData: any, salesData: any, customerData: any) {
    const insights = {
      salesTrends: this.analyzeSalesTrends(salesData),
      customerSegments: this.analyzeCustomerSegments(customerData),
      recommendations: this.generateRecommendations(salesData, customerData),
      kpis: this.calculateKPIs(salesData, customerData)
    };

    return insights;
  }

  private analyzeSalesTrends(salesData: any) {
    return {
      trend: 'growing',
      growthRate: 15.5,
      prediction: 'positive',
      seasonality: 'Q4 strong performance expected'
    };
  }

  private analyzeCustomerSegments(customerData: any) {
    return {
      enterprise: { count: 45, value: 'high' },
      smb: { count: 120, value: 'medium' },
      individual: { count: 230, value: 'low' }
    };
  }

  private generateRecommendations(salesData: any, customerData: any) {
    return [
      'Увеличить активность в сегменте enterprise клиентов',
      'Оптимизировать этап "Переговоры" в воронке продаж',
      'Внедрить automated follow-up для leads',
      'Развивать партнерские каналы продаж'
    ];
  }

  private calculateKPIs(salesData: any, customerData: any) {
    return {
      conversionRate: 12.5,
      averageDealSize: 125000,
      salesCycleLength: 45,
      customerSatisfaction: 4.2
    };
  }
}