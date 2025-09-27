import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../user-identity-access/authentication/infrastructure/guards/jwt-auth.guard';
import { 
  DocumentPersistenceEntity, 
  DocumentCommentEntity, 
  DocumentAccessLogEntity 
} from '../persistence/document.persistence.entity';
import { 
  CreateDocumentDto, 
  UpdateDocumentDto, 
  DocumentCommentDto, 
  DocumentSearchDto,
  DocumentType,
  DocumentStatus,
  DocumentPriority,
  DocumentAccessLevel
} from '../dto/document.dto';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IsNull } from 'typeorm';
import { S3Service } from '../../../../../shared/services/s3.service';

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentController {
  
  constructor(
    @InjectRepository(DocumentPersistenceEntity)
    private readonly documentRepository: Repository<DocumentPersistenceEntity>,
    
    @InjectRepository(DocumentCommentEntity)
    private readonly commentRepository: Repository<DocumentCommentEntity>,
    
    @InjectRepository(DocumentAccessLogEntity)
    private readonly accessLogRepository: Repository<DocumentAccessLogEntity>,
    
    private readonly s3Service: S3Service
  ) {
    console.log('📄 DocumentController initialized');
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a new document' })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  async uploadDocument(
    @UploadedFile() file: any,
    @Body() createDocumentDto: CreateDocumentDto,
    @Req() req: any
  ) {
    console.log('🚀 UPLOAD METHOD CALLED');
    console.log('📄 File object:', file);
    console.log('📄 CreateDocumentDto:', createDocumentDto);
    console.log('📄 Request user:', req.user);
    
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      console.log('📄 Upload request received:', {
        organizationId,
        userId,
        file: file ? {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          buffer: !!file.buffer,
          data: !!file.data
        } : null,
        createDocumentDto
      });

      if (!file) {
        return {
          success: false,
          message: 'No file provided'
        };
      }

      console.log('File object:', {
        originalname: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        buffer: !!file.buffer,
        data: !!file.data
      });

      // Generate file hash for integrity
      let fileBuffer: Buffer;
      if (file.buffer) {
        fileBuffer = file.buffer;
      } else {
        // Fallback: create empty buffer
        fileBuffer = Buffer.from('');
      }
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Upload to S3
      const s3Result = await this.s3Service.uploadFile(
        fileBuffer,
        file.originalname || 'unknown',
        file.mimetype || 'application/octet-stream',
        organizationId,
        userId,
        createDocumentDto.documentType,
        createDocumentDto.category
      );

      // Create document entity
      const document = this.documentRepository.create({
        id: uuidv4(),
        organizationId,
        title: createDocumentDto.title || file.originalname,
        description: createDocumentDto.description,
        documentType: createDocumentDto.documentType || DocumentType.OTHER,
        category: createDocumentDto.category,
        fileName: file.originalname || 'unknown',
        filePath: `./uploads/${file.filename || uuidv4()}`,
        s3Key: s3Result.key,
        s3Url: s3Result.url,
        fileSize: file.size || 0,
        mimeType: file.mimetype || 'application/octet-stream',
        fileHash,
        version: 1,
        isLatestVersion: true,
        status: DocumentStatus.DRAFT,
        priority: createDocumentDto.priority || DocumentPriority.NORMAL,
        customerId: createDocumentDto.customerId,
        dealId: createDocumentDto.dealId,
        createdBy: userId,
        assignedTo: createDocumentDto.assignedTo,
        dueDate: createDocumentDto.dueDate ? new Date(createDocumentDto.dueDate) : undefined,
        tags: createDocumentDto.tags || [],
        customFields: createDocumentDto.customFields,
        accessLevel: createDocumentDto.accessLevel || DocumentAccessLevel.ORGANIZATION,
        collaborators: createDocumentDto.collaborators || [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedDocument = await this.documentRepository.save(document);

      // Log access
      await this.logDocumentAccess(savedDocument.id, userId, 'upload', req);

      return {
        success: true,
        data: {
          id: savedDocument.id,
          title: savedDocument.title,
          fileName: savedDocument.fileName,
          documentType: savedDocument.documentType,
          status: savedDocument.status,
          createdAt: savedDocument.createdAt
        },
        message: 'Document uploaded successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to upload document'
      };
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get documents list with search and filters' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getDocuments(
    @Query() searchDto: DocumentSearchDto,
    @Req() req: any
  ) {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      const queryBuilder = this.documentRepository.createQueryBuilder('document');

      // Organization filter
      queryBuilder.where('document.organizationId = :organizationId', { organizationId });
      queryBuilder.andWhere('document.deletedAt IS NULL');

      // Search filter
      if (searchDto.search) {
        queryBuilder.andWhere(`(
          document.title ILIKE :search OR
          document.description ILIKE :search OR
          document.fileName ILIKE :search
        )`, { search: `%${searchDto.search}%` });
      }

      // Document type filter
      if (searchDto.documentType) {
        queryBuilder.andWhere('document.documentType = :documentType', { documentType: searchDto.documentType });
      }

      // Status filter
      if (searchDto.status) {
        queryBuilder.andWhere('document.status = :status', { status: searchDto.status });
      }

      // Category filter
      if (searchDto.category) {
        queryBuilder.andWhere('document.category = :category', { category: searchDto.category });
      }

      // Customer filter
      if (searchDto.customerId) {
        queryBuilder.andWhere('document.customerId = :customerId', { customerId: searchDto.customerId });
      }

      // Assigned to filter
      if (searchDto.assignedTo) {
        queryBuilder.andWhere('document.assignedTo = :assignedTo', { assignedTo: searchDto.assignedTo });
      }

      // Tags filter
      if (searchDto.tags && searchDto.tags.length > 0) {
        queryBuilder.andWhere('document.tags && :tags', { tags: searchDto.tags });
      }

      // Count total
      const total = await queryBuilder.getCount();

      // Apply pagination
      const page = searchDto.page || 1;
      const limit = searchDto.limit || 20;
      const offset = (page - 1) * limit;
      queryBuilder.skip(offset).take(limit);

      // Apply sorting
      queryBuilder.orderBy(`document.${searchDto.sortBy}`, searchDto.sortOrder);

      const documents = await queryBuilder.getMany();

      return {
        success: true,
        data: {
          documents: documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            description: doc.description,
            documentType: doc.documentType,
            category: doc.category,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            version: doc.version,
            status: doc.status,
            priority: doc.priority,
            customerId: doc.customerId,
            dealId: doc.dealId,
            assignedTo: doc.assignedTo,
            dueDate: doc.dueDate,
            tags: doc.tags,
            accessLevel: doc.accessLevel,
            collaborators: doc.collaborators,
            downloadsCount: doc.downloadsCount,
            viewsCount: doc.viewsCount,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch documents'
      };
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiResponse({ status: 200, description: 'Document retrieved successfully' })
  async getDocument(@Param('id') id: string, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      const document = await this.documentRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!document) {
        return {
          success: false,
          message: 'Document not found'
        };
      }

      // Log view access
      await this.logDocumentAccess(id, userId, 'view', req);

      // Increment view count
      await this.documentRepository.update(id, { 
        viewsCount: document.viewsCount + 1 
      });

      return {
        success: true,
        data: {
          id: document.id,
          title: document.title,
          description: document.description,
          documentType: document.documentType,
          category: document.category,
          fileName: document.fileName,
          filePath: document.filePath,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          fileHash: document.fileHash,
          version: document.version,
          isLatestVersion: document.isLatestVersion,
          parentDocumentId: document.parentDocumentId,
          status: document.status,
          priority: document.priority,
          customerId: document.customerId,
          dealId: document.dealId,
          createdBy: document.createdBy,
          assignedTo: document.assignedTo,
          reviewedBy: document.reviewedBy,
          approvedBy: document.approvedBy,
          dueDate: document.dueDate,
          reviewedAt: document.reviewedAt,
          approvedAt: document.approvedAt,
          archivedAt: document.archivedAt,
          tags: document.tags,
          customFields: document.customFields,
          accessLevel: document.accessLevel,
          collaborators: document.collaborators,
          commentsCount: document.commentsCount,
          downloadsCount: document.downloadsCount,
          viewsCount: document.viewsCount + 1,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch document'
      };
    }
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download document file' })
  @ApiResponse({ status: 200, description: 'Document downloaded successfully' })
  async downloadDocument(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      const document = await this.documentRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      // Log download access
      await this.logDocumentAccess(id, userId, 'download', req);

      // Increment download count
      await this.documentRepository.update(id, { 
        downloadsCount: document.downloadsCount + 1 
      });

      // Check if document is stored in S3
      if (document.s3Key) {
        // Generate presigned URL for S3 download
        const downloadUrl = await this.s3Service.generateDownloadUrl(document.s3Key, 3600); // 1 hour
        
        return res.json({
          success: true,
          downloadUrl,
          fileName: document.fileName,
          fileSize: document.fileSize,
          mimeType: document.mimeType
        });
      } else {
        // Fallback to local file system
        if (!fs.existsSync(document.filePath)) {
          return res.status(404).json({
            success: false,
            message: 'File not found on server'
          });
        }

        // Set response headers
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        res.setHeader('Content-Length', document.fileSize.toString());

        // Stream file
        const fileStream = fs.createReadStream(document.filePath);
        fileStream.pipe(res);
        
        return; // Explicit return for TypeScript
      }

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to download document'
      });
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update document by ID' })
  @ApiResponse({ status: 200, description: 'Document updated successfully' })
  async updateDocument(
    @Param('id') id: string,
    @Body() updateDto: UpdateDocumentDto,
    @Req() req: any
  ) {
    try {
      const organizationId = req.user.organizationId;

      const document = await this.documentRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!document) {
        return {
          success: false,
          message: 'Document not found'
        };
      }

      // Update document
      const updatedDocument = await this.documentRepository.save({
        ...document,
        ...updateDto,
        updatedAt: new Date()
      });

      return {
        success: true,
        data: {
          id: updatedDocument.id,
          title: updatedDocument.title,
          status: updatedDocument.status,
          updatedAt: updatedDocument.updatedAt
        },
        message: 'Document updated successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to update document'
      };
    }
  }


  @Post(':id/comments')
  @ApiOperation({ summary: 'Add comment to document' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  async addComment(
    @Param('id') id: string,
    @Body() commentDto: DocumentCommentDto,
    @Req() req: any
  ) {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      // Check if document exists
      const document = await this.documentRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!document) {
        return {
          success: false,
          message: 'Document not found'
        };
      }

      // Create comment
      const comment = this.commentRepository.create({
        id: uuidv4(),
        documentId: id,
        userId,
        comment: commentDto.comment,
        parentCommentId: commentDto.parentCommentId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedComment = await this.commentRepository.save(comment);

      // Update document comments count
      await this.documentRepository.update(id, {
        commentsCount: document.commentsCount + 1
      });

      return {
        success: true,
        data: {
          id: savedComment.id,
          comment: savedComment.comment,
          createdAt: savedComment.createdAt
        },
        message: 'Comment added successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to add comment'
      };
    }
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get document comments' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  async getComments(@Param('id') id: string, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      // Check if document exists
      const document = await this.documentRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!document) {
        return {
          success: false,
          message: 'Document not found'
        };
      }

      const comments = await this.commentRepository.find({
        where: { documentId: id },
        order: { createdAt: 'ASC' }
      });

      return {
        success: true,
        data: {
          comments: comments.map(comment => ({
            id: comment.id,
            comment: comment.comment,
            parentCommentId: comment.parentCommentId,
            isResolved: comment.isResolved,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt
          }))
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch comments'
      };
    }
  }

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Get document analytics summary' })
  @ApiResponse({ status: 200, description: 'Document analytics retrieved successfully' })
  async getDocumentAnalytics(@Req() req: any) {
    try {
      const organizationId = req.user.organizationId;

      if (!organizationId) {
        return {
          success: false,
          message: 'Organization ID is required'
        };
      }

      // Get total documents
      const totalDocuments = await this.documentRepository.count({
        where: { organizationId, deletedAt: IsNull() }
      });

      // Get documents by type
      const documentsByType = await this.documentRepository
        .createQueryBuilder('document')
        .select('document.documentType', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('document.organizationId = :organizationId', { organizationId })
        .andWhere('document.deletedAt IS NULL')
        .groupBy('document.documentType')
        .getRawMany();

      // Get documents by status
      const documentsByStatus = await this.documentRepository
        .createQueryBuilder('document')
        .select('document.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('document.organizationId = :organizationId', { organizationId })
        .andWhere('document.deletedAt IS NULL')
        .groupBy('document.status')
        .getRawMany();

      // Get total file size
      const totalFileSize = await this.documentRepository
        .createQueryBuilder('document')
        .select('SUM(document.fileSize)', 'total')
        .where('document.organizationId = :organizationId', { organizationId })
        .andWhere('document.deletedAt IS NULL')
        .getRawOne();

      // Get recent documents (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentDocuments = await this.documentRepository
        .createQueryBuilder('document')
        .where('document.organizationId = :organizationId', { organizationId })
        .andWhere('document.deletedAt IS NULL')
        .andWhere('document.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount();

      return {
        success: true,
        data: {
          totalDocuments,
          documentsByType: documentsByType.reduce((acc, item) => {
            acc[item.type] = parseInt(item.count);
            return acc;
          }, {}),
          documentsByStatus: documentsByStatus.reduce((acc, item) => {
            acc[item.status] = parseInt(item.count);
            return acc;
          }, {}),
          totalFileSize: parseInt(totalFileSize.total) || 0,
          recentDocuments
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to fetch document analytics'
      };
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete document by ID (soft delete)' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteDocument(@Param('id') id: string, @Req() req: any) {
    try {
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      const document = await this.documentRepository.findOne({
        where: { id, organizationId, deletedAt: IsNull() }
      });

      if (!document) {
        return {
          success: false,
          message: 'Document not found'
        };
      }

      // Soft delete in database
      await this.documentRepository.update(id, { 
        deletedAt: new Date(),
        updatedAt: new Date()
      });

      // Log deletion access
      await this.logDocumentAccess(id, userId, 'delete', req);

      // Note: We don't delete from S3 immediately for data recovery purposes
      // S3 files can be cleaned up by a separate cleanup job

      return {
        success: true,
        message: 'Document deleted successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to delete document'
      };
    }
  }

  @Post('scrape-website')
  @ApiOperation({ summary: 'Scrape website content for AI analysis' })
  @ApiResponse({ status: 200, description: 'Website scraped successfully' })
  async scrapeWebsite(
    @Body() scrapeDto: { url: string; scanAll?: boolean; maxPages?: number },
    @Req() req: any
  ) {
    try {
      const { url, scanAll = true, maxPages = 100 } = scrapeDto;
      const organizationId = req.user.organizationId;
      const userId = req.user.id;

      if (!url) {
        return {
          success: false,
          message: 'URL is required'
        };
      }

      // Normalize URL
      let normalizedUrl = url.trim();
      if (!normalizedUrl.match(/^https?:\/\//)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      console.log(`🔍 Starting website scraping for: ${normalizedUrl}`);

      // Real website scraping using fetch
      const scrapedContent = await this.scrapeWebsiteContent(normalizedUrl, scanAll, maxPages);

      return {
        success: true,
        content: scrapedContent,
        url: normalizedUrl,
        pagesScraped: scanAll ? Math.min(maxPages, 15) : 1,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('❌ Website scraping failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to scrape website'
      };
    }
  }

  // Real website scraping method
  private async scrapeWebsiteContent(url: string, scanAll: boolean, maxPages: number): Promise<string> {
    try {
      console.log(`🌐 Fetching content from: ${url}`);
      
      // Fetch the main page
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
      
      // Extract additional information
      const domain = new URL(url).hostname;
      const title = this.extractTitle(html);
      const description = this.extractDescription(html);
      const links = this.extractLinks(html, url);
      const emails = this.extractEmails(textContent);
      const phones = this.extractPhones(textContent);

      // If scanAll is true, try to scrape additional pages
      let additionalPages = '';
      if (scanAll && links.length > 0) {
        const pagesToScrape = Math.min(maxPages - 1, links.length); // -1 for main page
        additionalPages = await this.scrapeAdditionalPages(links.slice(0, pagesToScrape));
      }

      // Compile comprehensive content
      const comprehensiveContent = `
# Website Analysis: ${domain}

## Basic Information:
- **Website**: ${url}
- **Title**: ${title || 'Not found'}
- **Description**: ${description || 'Not found'}
- **Domain**: ${domain}

## Main Page Content:
${textContent}

## Contact Information:
- **Emails Found**: ${emails.length > 0 ? emails.join(', ') : 'None found'}
- **Phones Found**: ${phones.length > 0 ? phones.join(', ') : 'None found'}

## Additional Pages Scraped:
${scanAll ? additionalPages : '- Only main page scraped'}

## Technical Details:
- **Main Page Size**: ${html.length} characters
- **Text Content Size**: ${textContent.length} characters
- **Links Found**: ${links.length}
- **Pages Scraped**: ${scanAll ? Math.min(maxPages, links.length + 1) : 1}

## Content Analysis:
${this.analyzeContent(textContent)}
      `.trim();

      return comprehensiveContent;

    } catch (error) {
      console.error(`❌ Failed to scrape ${url}:`, error);
      
      // Return fallback content with error info
      const domain = new URL(url).hostname;
      return `
# Website Analysis: ${domain}

## Error Information:
- **URL**: ${url}
- **Error**: ${error instanceof Error ? error.message : 'Unknown error'}
- **Status**: Failed to scrape website content

## Fallback Analysis:
This website could not be automatically scraped. This might be due to:
- Website requiring JavaScript to load content
- Anti-bot protection
- Network connectivity issues
- Website being temporarily unavailable

## Recommendation:
Please provide manual content or try again later.
      `.trim();
    }
  }

  private extractTextFromHtml(html: string): string {
    // Simple HTML tag removal and text extraction
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

  private extractTitle(html: string): string | null {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return titleMatch?.[1]?.trim() || null;
  }

  private extractDescription(html: string): string | null {
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    return descMatch?.[1]?.trim() || null;
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      if (href) {
        try {
          const fullUrl = new URL(href, baseUrl).href;
          if (fullUrl.startsWith(baseUrl) && !links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }
    
    return links.slice(0, 20); // Limit to 20 links
  }

  private extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex) || [];
    return [...new Set(emails)]; // Remove duplicates
  }

  private extractPhones(text: string): string[] {
    const phoneRegex = /(\+?7|8)?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}/g;
    const phones = text.match(phoneRegex) || [];
    return [...new Set(phones)]; // Remove duplicates
  }

  private async scrapeAdditionalPages(links: string[]): Promise<string> {
    let additionalContent = '';
    
    for (const link of links.slice(0, 5)) { // Limit to 5 additional pages
      try {
        console.log(`🔗 Scraping additional page: ${link}`);
        const response = await fetch(link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          const textContent = this.extractTextFromHtml(html);
          additionalContent += `\n### Page: ${link}\n${textContent.substring(0, 500)}...\n`;
        }
      } catch (error) {
        console.log(`⚠️ Failed to scrape ${link}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return additionalContent;
  }

  private analyzeContent(text: string): string {
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    
    // Look for business-related keywords
    const businessKeywords = ['компания', 'услуги', 'продукты', 'клиенты', 'бизнес', 'продажи', 'маркетинг'];
    const foundKeywords = businessKeywords.filter(keyword => 
      words.some(word => word.includes(keyword))
    );
    
    return `
- **Word Count**: ${wordCount}
- **Business Keywords Found**: ${foundKeywords.join(', ') || 'None'}
- **Content Type**: ${wordCount > 1000 ? 'Detailed' : wordCount > 500 ? 'Moderate' : 'Brief'}
- **Language**: ${this.detectLanguage(text)}
    `.trim();
  }

  private detectLanguage(text: string): string {
    const cyrillicCount = (text.match(/[а-яё]/gi) || []).length;
    const latinCount = (text.match(/[a-z]/gi) || []).length;
    
    if (cyrillicCount > latinCount) return 'Russian/Kazakh';
    if (latinCount > cyrillicCount) return 'English';
    return 'Mixed';
  }

  // Helper method to log document access
  private async logDocumentAccess(
    documentId: string, 
    userId: string, 
    action: string, 
    req: any
  ) {
    try {
      const accessLog = this.accessLogRepository.create({
        id: uuidv4(),
        documentId,
        userId,
        action,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        createdAt: new Date()
      });

      await this.accessLogRepository.save(accessLog);
    } catch (error) {
      console.error('Failed to log document access:', error);
    }
  }
}