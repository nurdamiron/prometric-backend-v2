import { Controller, Post, Body, Get, Param, UseGuards, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../user-identity-access/authentication/infrastructure/guards/jwt-auth.guard';
import { IsString, IsUrl, MaxLength, IsEnum, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WebsiteScrapingService } from '../external-services/website-scraping.service';
import { RAGService, RAGQuery } from '../../application/rag.service';
import { EmbeddingService } from '../external-services/embedding.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeDocumentEntity } from '../persistence/knowledge-document.entity';

export class ScrapeWebsiteDto {
  @ApiProperty()
  @IsUrl({}, { message: 'Must be a valid URL' })
  @MaxLength(500)
  url: string;

  @ApiProperty({ enum: ['public', 'confidential', 'restricted'], default: 'public' })
  @IsEnum(['public', 'confidential', 'restricted'])
  accessLevel: 'public' | 'confidential' | 'restricted' = 'public';
}

export class AddManualContentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50000)
  content: string;

  @ApiProperty({ enum: ['public', 'confidential', 'restricted'], default: 'public' })
  @IsEnum(['public', 'confidential', 'restricted'])
  accessLevel: 'public' | 'confidential' | 'restricted' = 'public';
}

export class RAGSearchDto {
  @ApiProperty({ description: 'Search query for RAG system' })
  @IsString()
  @MaxLength(1000)
  query: string;

  @ApiProperty({ description: 'Maximum number of results', required: false, default: 5 })
  @IsOptional()
  maxResults?: number;

  @ApiProperty({ description: 'Include document chunks in results', required: false, default: true })
  @IsOptional()
  includeChunks?: boolean;

  @ApiProperty({ description: 'Use hybrid search (semantic + keyword)', required: false, default: true })
  @IsOptional()
  hybridSearch?: boolean;

  @ApiProperty({
    description: 'Access levels to search',
    enum: ['public', 'confidential', 'restricted'],
    isArray: true,
    required: false
  })
  @IsOptional()
  @IsArray()
  accessLevel?: string[];
}

@ApiTags('ai-knowledge')
@Controller('ai/knowledge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeManagementController {
  constructor(
    private readonly websiteScrapingService: WebsiteScrapingService,
    private readonly ragService: RAGService,
    private readonly embeddingService: EmbeddingService,
    @InjectRepository(KnowledgeDocumentEntity)
    private readonly knowledgeRepository: Repository<KnowledgeDocumentEntity>
  ) {}

  @Post('scrape-website')
  @ApiOperation({ summary: 'Scrape website for AI knowledge base (as per architecture plan)' })
  @ApiResponse({ status: 200, description: 'Website content extracted for AI training' })
  async scrapeWebsite(@Body() dto: ScrapeWebsiteDto, @Req() req: any) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      // Use DDD domain service for website scraping
      const scrapedContent = await this.websiteScrapingService.scrapeWebsite(dto.url);

      // TODO: Save to knowledge base using domain aggregate
      // TODO: Generate embeddings using Vertex AI
      // TODO: Store in pgvector with organization isolation

      return {
        success: true,
        data: {
          title: scrapedContent.title,
          wordCount: scrapedContent.wordCount,
          chunksCount: scrapedContent.chunks.length,
          language: scrapedContent.language,
          accessLevel: dto.accessLevel,
          organizationId,
          scrapedAt: scrapedContent.metadata.scrapedAt
        },
        message: 'Website content scraped and ready for AI knowledge base (DDD compliant)'
      };

    } catch (error: any) {
      throw new BadRequestException(`Website scraping failed: ${error.message}`);
    }
  }

  @Post('add-manual-content')
  @ApiOperation({ summary: 'Add manual content to AI knowledge base' })
  @ApiResponse({ status: 200, description: 'Manual content added to knowledge base' })
  async addManualContent(@Body() dto: AddManualContentDto, @Req() req: any) {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      // Create and save knowledge document
      const document = this.knowledgeRepository.create({
        organizationId,
        title: dto.title,
        content: dto.content,
        source: 'manual',
        accessLevel: dto.accessLevel,
        language: 'ru',
        createdBy: userId
      });

      const savedDocument = await this.knowledgeRepository.save(document);

      return {
        success: true,
        data: {
          documentId: savedDocument.id,
          title: dto.title,
          wordCount: dto.content.split(' ').length,
          accessLevel: dto.accessLevel,
          organizationId,
          addedAt: new Date().toISOString()
        },
        message: 'Manual content added to knowledge base and saved to database'
      };

    } catch (error: any) {
      throw new BadRequestException(`Failed to add content: ${error.message}`);
    }
  }

  @Post('search')
  @ApiOperation({ summary: 'Search knowledge base using RAG (Retrieval-Augmented Generation)' })
  @ApiResponse({ status: 200, description: 'RAG search results with relevance scores' })
  async searchKnowledge(@Body() dto: RAGSearchDto, @Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      const ragQuery: RAGQuery = {
        query: dto.query,
        organizationId,
        maxResults: dto.maxResults || 5,
        includeChunks: dto.includeChunks !== false,
        hybridSearch: dto.hybridSearch !== false,
        accessLevel: dto.accessLevel || ['public', 'confidential']
      };

      const results = await this.ragService.searchRelevantDocuments(ragQuery);

      return {
        success: true,
        data: {
          query: dto.query,
          resultsCount: results.length,
          results: results.map(result => ({
            documentId: result.documentId,
            title: result.title,
            content: result.content.substring(0, 500) + '...', // Truncate for API response
            relevanceScore: Math.round(result.relevanceScore * 100) / 100,
            accessLevel: result.accessLevel,
            source: result.source,
            chunks: result.chunks?.map(chunk => ({
              chunkId: chunk.chunkId,
              content: chunk.content.substring(0, 200) + '...',
              relevanceScore: Math.round(chunk.relevanceScore * 100) / 100
            }))
          }))
        },
        message: `Found ${results.length} relevant documents using ${dto.hybridSearch ? 'hybrid' : 'semantic'} search`
      };

    } catch (error: any) {
      throw new BadRequestException(`RAG search failed: ${error.message}`);
    }
  }

  @Post('process-embeddings/bulk')
  @ApiOperation({ summary: 'Generate embeddings for all documents in organization' })
  @ApiResponse({ status: 200, description: 'Bulk embedding processing started' })
  async processBulkEmbeddings(@Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      // Process embeddings asynchronously
      this.ragService.processBulkDocumentEmbeddings(organizationId).catch(error => {
        console.error('Bulk embedding processing failed:', error);
      });

      return {
        success: true,
        message: 'Bulk embedding processing started',
        data: { organizationId }
      };

    } catch (error: any) {
      throw new BadRequestException(`Failed to start bulk processing: ${error.message}`);
    }
  }

  @Post('process-embeddings/:documentId')
  @ApiOperation({ summary: 'Generate embeddings for a specific document' })
  @ApiResponse({ status: 200, description: 'Document embeddings processed successfully' })
  async processDocumentEmbeddings(@Param('documentId') documentId: string, @Req() req: any) {
    try {
      await this.ragService.processDocumentEmbeddings(documentId);

      return {
        success: true,
        message: 'Document embeddings processed successfully',
        data: { documentId }
      };

    } catch (error: any) {
      throw new BadRequestException(`Failed to process embeddings: ${error.message}`);
    }
  }

  @Get('embeddings/stats')
  @ApiOperation({ summary: 'Get embedding statistics for organization' })
  @ApiResponse({ status: 200, description: 'Embedding statistics' })
  async getEmbeddingStats(@Req() req: any) {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      throw new UnauthorizedException('User must belong to an organization');
    }

    try {
      const stats = await this.ragService.getEmbeddingStats(organizationId);

      return {
        success: true,
        data: {
          ...stats,
          estimatedCost: `$${stats.estimatedCost.toFixed(4)}`
        },
        message: 'Embedding statistics retrieved successfully'
      };

    } catch (error: any) {
      throw new BadRequestException(`Failed to get embedding stats: ${error.message}`);
    }
  }
}