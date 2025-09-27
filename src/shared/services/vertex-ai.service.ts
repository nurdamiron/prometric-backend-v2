import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VertexAI } from '@google-cloud/vertexai';

export interface VertexAIMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface VertexAIRequest {
  contents: VertexAIMessage[];
  generationConfig: {
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
  };
}

export interface VertexAIResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}

@Injectable()
export class VertexAIService {
  private readonly logger = new Logger(VertexAIService.name);
  private vertexAI: VertexAI;
  private projectId: string;
  private location: string;
  private model: string;

  constructor(private configService: ConfigService) {
    this.projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID') || 'storied-algebra-457806-r5';
    this.location = this.configService.get<string>('GOOGLE_CLOUD_LOCATION') || 'us-central1';
    this.model = this.configService.get<string>('GOOGLE_CLOUD_MODEL') || 'gemini-2.5-pro';

    try {
      this.vertexAI = new VertexAI({
        project: this.projectId,
        location: this.location,
      });
      this.logger.log(`✅ VertexAI initialized for project: ${this.projectId}`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize VertexAI:', error);
    }
  }

  async generateText(prompt: string, options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    try {
      if (!this.vertexAI) {
        throw new Error('VertexAI not initialized');
      }

      const model = this.vertexAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: options?.temperature || 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: options?.maxTokens || 8192,
        },
      });

      const request: VertexAIRequest = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: options?.temperature || 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: options?.maxTokens || 8192,
        },
      };

      this.logger.log(`🤖 Sending request to VertexAI model: ${this.model}`);
      
      const result = await model.generateContent(request);
      const response = result.response as VertexAIResponse;
      
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate?.content?.parts?.[0]?.text) {
          const generatedText = candidate.content.parts[0].text;
          this.logger.log(`✅ VertexAI response received (${generatedText.length} chars)`);
          return generatedText;
        } else {
          throw new Error('Invalid response structure from VertexAI');
        }
      } else {
        throw new Error('No response generated from VertexAI');
      }

    } catch (error) {
      this.logger.error('❌ VertexAI generation failed:', error);
      throw error;
    }
  }

  async generateBusinessAnalysis(content: string, url: string, language: string = 'ru'): Promise<any> {
    try {
      const languagePrompts = this.getLanguagePrompts(language);
      
      const prompt = `Analyze this website and return business information in JSON format.

Website: ${url}
Content: ${content.substring(0, 2000)}

Return this JSON structure with detailed content:
{
  "businessType": "business type description",
  "industry": "industry analysis", 
  "productsServices": ["product1", "product2"],
  "targetMarket": "target market description",
  "companySize": "company size assessment",
  "businessKeywords": ["keyword1", "keyword2"],
  "language": "${language}",
  "analysis": "detailed business analysis with insights",
  "insights": "strategic insights about the business", 
  "recommendations": "actionable recommendations for development",
  "confidence": 0.85
}`;

      const response = await this.generateText(prompt, {
        temperature: 0.3,
        maxTokens: 6144
      });

      // Parse response
      try {
        const cleanResponse = response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleanResponse);
        console.log('✅ Business analysis parsed successfully');
        return parsed;
      } catch (error) {
        console.log('❌ Failed to parse response, using fallback');
        return {
          businessType: "Business",
          industry: "Industry",
          productsServices: ["Products/Services"],
          targetMarket: "Target market",
          companySize: "Company size",
          businessKeywords: ["keywords"],
          language: language,
          analysis: "Detailed business analysis based on website content and industry trends.",
          insights: "Strategic insights about the business model and market position.",
          recommendations: "Actionable recommendations for business development and growth.",
          confidence: 0.7
        };
      }


    } catch (error) {
      this.logger.error('❌ Business analysis generation failed:', error);
      throw error; // Don't use fallback, throw the error
    }
  }

  private getLanguagePrompts(language: string) {
    const prompts: Record<string, any> = {
      'ru': {
        instruction: 'Проанализируй этот веб-сайт и предоставь детальный бизнес-анализ компании.',
        request: 'Пожалуйста, проанализируй и предоставь следующую информацию в формате JSON:',
        businessTypeExample: 'тип бизнеса (например: производство, торговля, услуги, технологии)',
        industryExample: 'отрасль (например: текстильная промышленность, IT, консалтинг)',
        productsExample: 'список продуктов/услуг',
        targetMarketExample: 'целевая аудитория',
        companySizeExample: 'размер компании (малый, средний, крупный)',
        keywordsExample: 'ключевые бизнес-слова',
        analysisExample: 'детальный анализ бизнеса',
        insightsExample: 'ключевые инсайты о компании',
        recommendationsExample: 'рекомендации для развития',
        important: 'Важно: отвечай только в формате JSON, без дополнительного текста.'
      },
      'kk': {
        instruction: 'Бұл веб-сайтты талдап, компанияның толық бизнес-талдауын беріңіз.',
        request: 'JSON форматында келесі ақпаратты талдап беріңіз:',
        businessTypeExample: 'бизнес түрі (мысалы: өндіріс, сауда, қызметтер, технологиялар)',
        industryExample: 'сала (мысалы: тоқыма өнеркәсібі, IT, консалтинг)',
        productsExample: 'өнімдер/қызметтер тізімі',
        targetMarketExample: 'мақсатты аудитория',
        companySizeExample: 'компания көлемі (кіші, орта, ірі)',
        keywordsExample: 'негізгі бизнес сөздер',
        analysisExample: 'толық бизнес талдауы',
        insightsExample: 'компания туралы негізгі түсініктер',
        recommendationsExample: 'даму ұсыныстары',
        important: 'Маңызды: тек JSON форматында жауап беріңіз, қосымша мәтінсіз.'
      },
      'en': {
        instruction: 'Analyze this website and provide a detailed business analysis of the company.',
        request: 'Please analyze and provide the following information in JSON format:',
        businessTypeExample: 'business type (e.g., manufacturing, retail, services, technology)',
        industryExample: 'industry (e.g., textile industry, IT, consulting)',
        productsExample: 'list of products/services',
        targetMarketExample: 'target audience',
        companySizeExample: 'company size (small, medium, large)',
        keywordsExample: 'key business keywords',
        analysisExample: 'detailed business analysis',
        insightsExample: 'key insights about the company',
        recommendationsExample: 'development recommendations',
        important: 'Important: respond only in JSON format, without additional text.'
      }
    };

    return prompts[language] || prompts['ru'];
  }

  private getFallbackAnalysis(language: string) {
    return {
      businessType: language === 'kk' ? 'Өндіріс' : language === 'en' ? 'Manufacturing' : 'Производство',
      industry: language === 'kk' ? 'Тоқыма өнеркәсібі' : language === 'en' ? 'Textile Industry' : 'Текстильная промышленность',
      productsServices: [language === 'kk' ? 'Тоқыма бұйымдары' : language === 'en' ? 'Textile products' : 'Текстильные изделия'],
      targetMarket: language === 'kk' ? 'B2B клиенттер' : language === 'en' ? 'B2B clients' : 'B2B клиенты',
      companySize: language === 'kk' ? 'Орта бизнес' : language === 'en' ? 'Medium business' : 'Средний бизнес',
      businessKeywords: [language === 'kk' ? 'тоқыма' : language === 'en' ? 'textile' : 'текстиль'],
      language: language,
      analysis: language === 'kk' ? 'AI талдау уақытша қолжетімді емес' : language === 'en' ? 'AI analysis temporarily unavailable' : 'AI анализ временно недоступен',
      insights: language === 'kk' ? 'Түсініктер уақытша қолжетімді емес' : language === 'en' ? 'Insights temporarily unavailable' : 'Инсайты временно недоступны',
      recommendations: language === 'kk' ? 'Ұсыныстар уақытша қолжетімді емес' : language === 'en' ? 'Recommendations temporarily unavailable' : 'Рекомендации временно недоступны',
      confidence: 0.1
    };
  }
}