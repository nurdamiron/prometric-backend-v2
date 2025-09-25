import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeDocumentEntity, DocumentChunkEntity } from '../infrastructure/persistence/knowledge-document.entity';
import { EmbeddingService } from '../infrastructure/external-services/embedding.service';

export interface RAGSearchResult {
  documentId: string;
  title: string;
  content: string;
  relevanceScore: number;
  accessLevel: string;
  source: string;
  chunks?: RAGChunkResult[];
}

export interface RAGChunkResult {
  chunkId: string;
  content: string;
  chunkIndex: number;
  relevanceScore: number;
}

export interface RAGQuery {
  query: string;
  organizationId: string;
  accessLevel?: string[];
  maxResults?: number;
  includeChunks?: boolean;
  hybridSearch?: boolean;
}

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);

  constructor(
    @InjectRepository(KnowledgeDocumentEntity)
    private readonly documentRepository: Repository<KnowledgeDocumentEntity>,

    @InjectRepository(DocumentChunkEntity)
    private readonly chunkRepository: Repository<DocumentChunkEntity>,

    private readonly embeddingService: EmbeddingService
  ) {}

  async searchRelevantDocuments(ragQuery: RAGQuery): Promise<RAGSearchResult[]> {
    const {
      query,
      organizationId,
      accessLevel = ['public', 'confidential'],
      maxResults = 5,
      includeChunks = true,
      hybridSearch = true
    } = ragQuery;

    // Generate query embedding
    const queryEmbeddingResult = await this.embeddingService.generateEmbeddingForQuery(query);
    const queryEmbedding = queryEmbeddingResult.embedding;

    if (hybridSearch) {
      return this.performHybridSearch(query, queryEmbedding, organizationId, accessLevel, maxResults, includeChunks);
    } else {
      return this.performSemanticSearch(queryEmbedding, organizationId, accessLevel, maxResults, includeChunks);
    }
  }

  async processDocumentEmbeddings(documentId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId }
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    try {
      // Generate document-level embedding
      const documentEmbedding = await this.embeddingService.generateEmbeddingForDocument(
        document.title,
        document.content
      );

      // Update document with embedding
      await this.documentRepository.update(documentId, {
        contentEmbedding: documentEmbedding.embedding,
        embeddingModel: documentEmbedding.model,
        embeddingCreatedAt: new Date(),
        embeddingTokens: documentEmbedding.tokensUsed
      });

      // Get document chunks
      const chunks = await this.chunkRepository.find({
        where: { documentId },
        order: { chunkIndex: 'ASC' }
      });

      if (chunks.length > 0) {
        // Generate embeddings for chunks in batches
        await this.processChunkEmbeddings(chunks);
      }

      this.logger.log(`Processed embeddings for document ${documentId} with ${chunks.length} chunks`);

    } catch (error: any) {
      this.logger.error(`Failed to process embeddings for document ${documentId}: ${error.message}`, error);
      throw error;
    }
  }

  async processBulkDocumentEmbeddings(organizationId: string): Promise<void> {
    const documents = await this.documentRepository.find({
      where: {
        organizationId
      }
      // TODO: Add proper TypeORM query for NULL embeddings
    });

    this.logger.log(`Processing embeddings for ${documents.length} documents in organization ${organizationId}`);

    for (const document of documents) {
      try {
        await this.processDocumentEmbeddings(document.id);
      } catch (error: any) {
        this.logger.error(`Failed to process embeddings for document ${document.id}: ${error.message}`);
        // Continue with other documents
      }
    }

    this.logger.log(`Completed bulk embedding processing for organization ${organizationId}`);
  }

  private async performSemanticSearch(
    queryEmbedding: number[],
    organizationId: string,
    accessLevel: string[],
    maxResults: number,
    includeChunks: boolean
  ): Promise<RAGSearchResult[]> {
    // Use raw SQL with pgvector functions for best performance
    const query = `
      SELECT DISTINCT
        kd.id as document_id,
        kd.title,
        kd.content,
        kd.access_level,
        kd.source,
        1 - (kd.content_embedding <=> $1::vector) as relevance_score
      FROM knowledge_documents kd
      WHERE
        kd.organization_id = $2
        AND kd.content_embedding IS NOT NULL
        AND kd.access_level = ANY($3)
        AND kd.deleted_at IS NULL
        AND (1 - (kd.content_embedding <=> $1::vector)) > 0.7
      ORDER BY kd.content_embedding <=> $1::vector
      LIMIT $4
    `;

    const results = await this.documentRepository.query(query, [
      JSON.stringify(queryEmbedding),
      organizationId,
      accessLevel,
      maxResults
    ]);

    const searchResults: RAGSearchResult[] = [];

    for (const row of results) {
      const searchResult: RAGSearchResult = {
        documentId: row.document_id,
        title: row.title,
        content: row.content,
        relevanceScore: parseFloat(row.relevance_score),
        accessLevel: row.access_level,
        source: row.source
      };

      if (includeChunks) {
        searchResult.chunks = await this.getRelevantChunks(
          queryEmbedding,
          row.document_id,
          5 // max chunks per document
        );
      }

      searchResults.push(searchResult);
    }

    return searchResults;
  }

  private async performHybridSearch(
    queryText: string,
    queryEmbedding: number[],
    organizationId: string,
    accessLevel: string[],
    maxResults: number,
    includeChunks: boolean
  ): Promise<RAGSearchResult[]> {
    // Hybrid search combining semantic similarity and keyword matching
    const query = `
      SELECT DISTINCT
        kd.id as document_id,
        kd.title,
        kd.content,
        kd.access_level,
        kd.source,
        1 - (kd.content_embedding <=> $1::vector) as semantic_score,
        ts_rank(to_tsvector('russian', kd.content || ' ' || kd.title), plainto_tsquery('russian', $2)) as keyword_score,
        (0.7 * (1 - (kd.content_embedding <=> $1::vector)) +
         0.3 * ts_rank(to_tsvector('russian', kd.content || ' ' || kd.title), plainto_tsquery('russian', $2))) as combined_score
      FROM knowledge_documents kd
      WHERE
        kd.organization_id = $3
        AND kd.content_embedding IS NOT NULL
        AND kd.access_level = ANY($4)
        AND kd.deleted_at IS NULL
        AND (
          (1 - (kd.content_embedding <=> $1::vector)) > 0.6
          OR
          to_tsvector('russian', kd.content || ' ' || kd.title) @@ plainto_tsquery('russian', $2)
        )
      ORDER BY combined_score DESC
      LIMIT $5
    `;

    const results = await this.documentRepository.query(query, [
      JSON.stringify(queryEmbedding),
      queryText,
      organizationId,
      accessLevel,
      maxResults
    ]);

    const searchResults: RAGSearchResult[] = [];

    for (const row of results) {
      const searchResult: RAGSearchResult = {
        documentId: row.document_id,
        title: row.title,
        content: row.content,
        relevanceScore: parseFloat(row.combined_score),
        accessLevel: row.access_level,
        source: row.source
      };

      if (includeChunks) {
        searchResult.chunks = await this.getRelevantChunks(
          queryEmbedding,
          row.document_id,
          3 // fewer chunks for hybrid search
        );
      }

      searchResults.push(searchResult);
    }

    return searchResults;
  }

  private async getRelevantChunks(
    queryEmbedding: number[],
    documentId: string,
    maxChunks: number
  ): Promise<RAGChunkResult[]> {
    const query = `
      SELECT
        dc.id as chunk_id,
        dc.content,
        dc.chunk_index,
        1 - (dc.chunk_embedding <=> $1::vector) as relevance_score
      FROM document_chunks dc
      WHERE
        dc.document_id = $2
        AND dc.chunk_embedding IS NOT NULL
        AND (1 - (dc.chunk_embedding <=> $1::vector)) > 0.6
      ORDER BY dc.chunk_embedding <=> $1::vector
      LIMIT $3
    `;

    const results = await this.chunkRepository.query(query, [
      JSON.stringify(queryEmbedding),
      documentId,
      maxChunks
    ]);

    return results.map((row: any) => ({
      chunkId: row.chunk_id,
      content: row.content,
      chunkIndex: row.chunk_index,
      relevanceScore: parseFloat(row.relevance_score)
    }));
  }

  private async processChunkEmbeddings(chunks: DocumentChunkEntity[]): Promise<void> {
    // Process chunks in batches to optimize API calls
    const batchSize = 50; // OpenAI allows up to 2048, but let's be conservative

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(chunk => chunk.content);

      try {
        const batchResult = await this.embeddingService.generateBatchEmbeddings(texts);

        // Update chunks with embeddings
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j]!;
          const embedding = batchResult.embeddings[j]!;
          const tokens = Math.ceil(batchResult.totalTokensUsed / batch.length); // Approximate tokens per chunk

          await this.chunkRepository.update(chunk.id, {
            chunkEmbedding: embedding,
            embeddingModel: batchResult.model,
            embeddingCreatedAt: new Date(),
            embeddingTokens: tokens
          });
        }

        this.logger.debug(`Processed embeddings for batch ${i / batchSize + 1} (${batch.length} chunks)`);

      } catch (error: any) {
        this.logger.error(`Failed to process chunk embeddings for batch ${i / batchSize + 1}: ${error.message}`, error);
        // Continue with next batch
      }
    }
  }

  async getEmbeddingStats(organizationId: string): Promise<{
    documentsWithEmbeddings: number;
    documentsWithoutEmbeddings: number;
    chunksWithEmbeddings: number;
    chunksWithoutEmbeddings: number;
    totalTokensUsed: number;
    estimatedCost: number;
  }> {
    // Use raw SQL queries for proper NULL checks
    const [
      docStatsWithEmbeddings,
      docStatsWithoutEmbeddings,
      chunkStatsWithEmbeddings,
      chunkStatsWithoutEmbeddings,
      tokenStats
    ] = await Promise.all([
      this.documentRepository.query(
        'SELECT COUNT(*) as count FROM knowledge_documents WHERE organization_id = $1 AND content_embedding IS NOT NULL',
        [organizationId]
      ),
      this.documentRepository.query(
        'SELECT COUNT(*) as count FROM knowledge_documents WHERE organization_id = $1 AND content_embedding IS NULL',
        [organizationId]
      ),
      this.chunkRepository.query(
        'SELECT COUNT(*) as count FROM document_chunks WHERE organization_id = $1 AND chunk_embedding IS NOT NULL',
        [organizationId]
      ),
      this.chunkRepository.query(
        'SELECT COUNT(*) as count FROM document_chunks WHERE organization_id = $1 AND chunk_embedding IS NULL',
        [organizationId]
      ),
      this.documentRepository.query(
        'SELECT SUM(embedding_tokens) as total_tokens FROM knowledge_documents WHERE organization_id = $1 AND embedding_tokens IS NOT NULL',
        [organizationId]
      )
    ]);

    const totalTokens = tokenStats[0]?.total_tokens || 0;
    const estimatedCost = this.embeddingService.estimateCost(totalTokens);

    return {
      documentsWithEmbeddings: parseInt(docStatsWithEmbeddings[0]?.count || '0'),
      documentsWithoutEmbeddings: parseInt(docStatsWithoutEmbeddings[0]?.count || '0'),
      chunksWithEmbeddings: parseInt(chunkStatsWithEmbeddings[0]?.count || '0'),
      chunksWithoutEmbeddings: parseInt(chunkStatsWithoutEmbeddings[0]?.count || '0'),
      totalTokensUsed: parseInt(totalTokens),
      estimatedCost
    };
  }
}