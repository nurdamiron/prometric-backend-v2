import { Injectable, BadRequestException } from '@nestjs/common';
import { VertexAIService } from '../../../../../shared/services/vertex-ai.service';

export interface WebsiteContent {
  title: string;
  description: string;
  content: string;
  headings: string[];
  keywords: string;
  language: 'ru' | 'kz' | 'en';
  wordCount: number;
  chunks: string[];
  metadata: {
    url: string;
    scrapedAt: Date;
    contentLength: number;
  };
}

export interface BusinessAnalysis {
  businessType: string;
  industry: string;
  productsServices: string[];
  targetMarket: string;
  companySize: string;
  businessKeywords: string[];
  language: string;
  wordCount: number;
  aiAnalysis: string;
  aiInsights: string;
  aiRecommendations: string;
  aiConfidence: number;
}

@Injectable()
export class WebsiteScrapingService {
  constructor(private readonly vertexAIService: VertexAIService) {}
  async scrapeWebsite(url: string): Promise<WebsiteContent> {
    try {
      // Normalize URL first
      let normalizedUrl = url.trim();
      if (!normalizedUrl.match(/^https?:\/\//)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // Security validation
      this.validateUrl(normalizedUrl);

      // For now, return mock structure until we fix cheerio dependencies
      return {
        title: 'Website Content (Structure Ready)',
        description: 'Website scraping infrastructure ready',
        content: 'Website scraping domain service is implemented according to DDD architecture.',
        headings: ['Main Content', 'About Us', 'Services'],
        keywords: 'business, kazakhstan, software',
        language: 'ru',
        wordCount: 25,
        chunks: ['Website scraping domain service is implemented according to DDD architecture.'],
        metadata: {
          url: normalizedUrl,
          scrapedAt: new Date(),
          contentLength: 75
        }
      };

    } catch (error: any) {
      throw new BadRequestException(`Website scraping failed: ${error.message}`);
    }
  }

  private validateUrl(url: string): void {
    try {
      console.log(`🔍 Validating URL: ${url}`);
      const urlObj = new URL(url);
      console.log(`✅ URL parsed successfully: ${urlObj.href}`);

      // Security: Block internal/private networks
      const hostname = urlObj.hostname.toLowerCase();
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^192\.168\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./
      ];

      for (const pattern of blockedPatterns) {
        if (pattern.test(hostname)) {
          throw new Error('Internal networks not allowed for security');
        }
      }

      // Require HTTPS for external sites (allow HTTP for testing)
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        throw new Error('Only HTTP/HTTPS URLs allowed');
      }

    } catch (error: any) {
      throw new BadRequestException(`Invalid URL: ${error.message}`);
    }
  }

  async analyzeBusinessDeeply(url: string, userLanguage: string = 'ru'): Promise<BusinessAnalysis> {
    try {
      // Normalize URL first
      let normalizedUrl = url.trim();
      if (!normalizedUrl.match(/^https?:\/\//)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // Step 1: Scrape website content
      const websiteContent = await this.scrapeWebsite(normalizedUrl);
      
      // Step 2: Real scraping with fetch
      const realContent = await this.scrapeRealContent(normalizedUrl);
      
      // Step 3: AI Analysis with Vertex AI (with user language)
      const aiAnalysis = await this.performAIBusinessAnalysis(realContent, normalizedUrl, userLanguage);
      
      return {
        businessType: aiAnalysis.businessType,
        industry: aiAnalysis.industry,
        productsServices: aiAnalysis.productsServices,
        targetMarket: aiAnalysis.targetMarket,
        companySize: aiAnalysis.companySize,
        businessKeywords: aiAnalysis.businessKeywords,
        language: aiAnalysis.language,
        wordCount: realContent.length,
        aiAnalysis: aiAnalysis.analysis,
        aiInsights: aiAnalysis.insights,
        aiRecommendations: aiAnalysis.recommendations,
        aiConfidence: aiAnalysis.confidence
      };

    } catch (error: any) {
      throw new BadRequestException(`Business analysis failed: ${error.message}`);
    }
  }

  private async scrapeRealContent(url: string): Promise<string> {
    try {
      console.log(`🌐 Fetching real content from: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log(`📄 Fetched ${html.length} characters from ${url}`);

      // Extract text content from HTML
      const textContent = this.extractTextFromHtml(html);
      console.log(`📝 Extracted ${textContent.length} characters of text content`);

      // Limit content to reasonable size for AI analysis (max 5000 chars)
      const limitedContent = textContent.substring(0, 5000);
      console.log(`✂️ Limited to ${limitedContent.length} characters for AI analysis`);

      return limitedContent;

    } catch (error) {
      console.error(`❌ Failed to scrape ${url}:`, error);
      throw error;
    }
  }

  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/&nbsp;/g, ' ') // Replace HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private async performAIBusinessAnalysis(content: string, url: string, userLanguage: string): Promise<any> {
    try {
      const domain = new URL(url).hostname;
      
      // Get language-specific prompts
      const languagePrompts = this.getLanguagePrompts(userLanguage);
      
      const prompt = `
${languagePrompts.instruction}

URL: ${url}
Domain: ${domain}
Website content: ${content.substring(0, 4000)}...

${languagePrompts.request}

{
  "businessType": "${languagePrompts.businessTypeExample}",
  "industry": "${languagePrompts.industryExample}",
  "productsServices": ["${languagePrompts.productsExample}"],
  "targetMarket": "${languagePrompts.targetMarketExample}",
  "companySize": "${languagePrompts.companySizeExample}",
  "businessKeywords": ["${languagePrompts.keywordsExample}"],
  "language": "detected language (ru/kz/en)",
  "analysis": "${languagePrompts.analysisExample}",
  "insights": "${languagePrompts.insightsExample}",
  "recommendations": "${languagePrompts.recommendationsExample}",
  "confidence": 0.95
}

${languagePrompts.important}
      `;

      const aiResponse = await this.vertexAIService.generateBusinessAnalysis(content, url, userLanguage);
      
      return {
        businessType: aiResponse.businessType || 'Не определено',
        industry: aiResponse.industry || 'Не определено',
        productsServices: aiResponse.productsServices || [],
        targetMarket: aiResponse.targetMarket || 'Не определено',
        companySize: aiResponse.companySize || 'Не определено',
        businessKeywords: aiResponse.businessKeywords || [],
        language: aiResponse.language || 'ru',
        analysis: aiResponse.analysis || 'Анализ недоступен',
        insights: aiResponse.insights || 'Инсайты недоступны',
        recommendations: aiResponse.recommendations || 'Рекомендации недоступны',
        confidence: aiResponse.confidence || 0.5
      };

    } catch (error) {
      console.error('❌ AI analysis failed:', error);
      
      // Fallback analysis
      return {
        businessType: 'Не определено',
        industry: 'Не определено',
        productsServices: [],
        targetMarket: 'Не определено',
        companySize: 'Не определено',
        businessKeywords: [],
        language: 'ru',
        analysis: 'AI анализ временно недоступен',
        insights: 'Инсайты временно недоступны',
        recommendations: 'Рекомендации временно недоступны',
        confidence: 0.1
      };
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

    return prompts[language] || prompts['ru']; // Default to Russian if language not supported
  }
}