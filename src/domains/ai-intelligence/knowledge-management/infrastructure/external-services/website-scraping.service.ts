import { Injectable, BadRequestException } from '@nestjs/common';

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

@Injectable()
export class WebsiteScrapingService {
  async scrapeWebsite(url: string): Promise<WebsiteContent> {
    try {
      // Security validation
      this.validateUrl(url);

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
          url,
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
      const urlObj = new URL(url);

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

      // Require HTTPS for external sites
      if (urlObj.protocol !== 'https:' && !hostname.endsWith('.kz')) {
        throw new Error('Only HTTPS URLs allowed');
      }

    } catch (error: any) {
      throw new BadRequestException(`Invalid URL: ${error.message}`);
    }
  }
}