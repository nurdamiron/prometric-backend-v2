import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokensUsed: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  totalTokensUsed: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private vertexAI: any;
  private credentials: any;
  private readonly model = 'gemini-embedding-001';
  private readonly outputDimensions = 1536; // Enhanced quality (768×2) while staying within PostgreSQL limits

  constructor(private readonly configService: ConfigService) {
    // Credentials will be loaded on first use
  }

  private async initializeVertexAI() {
    try {
      // Load Vertex AI credentials (same as in AI Orchestrator)
      const fs = await import('fs');
      const keyPath = './vertex-ai-key.json';
      const keyFile = fs.readFileSync(keyPath, 'utf8');
      this.credentials = JSON.parse(keyFile);

      // Initialize Vertex AI
      const { VertexAI } = await import('@google-cloud/vertexai');

      this.vertexAI = new VertexAI({
        project: this.credentials.project_id,
        location: 'us-central1',
        googleAuthOptions: {
          credentials: {
            client_email: this.credentials.client_email,
            private_key: this.credentials.private_key,
          }
        }
      });

      this.logger.log('Vertex AI initialized for embeddings with gemini-embedding-001');

    } catch (error: any) {
      this.logger.error('Failed to initialize Vertex AI:', error.message);
      throw new Error(`Vertex AI initialization failed: ${error.message}`);
    }
  }

  async generateEmbedding(text: string, taskType?: string): Promise<EmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty for embedding generation');
    }

    // Clean and prepare text
    const cleanedText = this.preprocessText(text);

    try {
      if (!this.credentials) {
        await this.initializeVertexAI();
      }

      // Use Vertex AI REST API directly for embeddings
      // The SDK doesn't have proper embedding support yet
      const { GoogleAuth } = await import('google-auth-library');

      const auth = new GoogleAuth({
        credentials: {
          client_email: this.credentials.client_email,
          private_key: this.credentials.private_key,
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });

      const accessToken = await auth.getAccessToken();

      const request = {
        instances: [{
          content: cleanedText,
          task_type: taskType || 'RETRIEVAL_DOCUMENT'
        }],
        parameters: {
          outputDimensionality: this.outputDimensions
        }
      };

      const response = await fetch(
        `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.credentials.project_id}/locations/us-central1/publishers/google/models/${this.model}:predict`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Vertex AI API error: ${error.error?.message || response.statusText}`);
      }

      const result = await response.json();

      if (!result.predictions || result.predictions.length === 0) {
        throw new Error('No predictions received from Vertex AI');
      }

      const prediction = result.predictions[0];
      if (!prediction.embeddings || !prediction.embeddings.values) {
        throw new Error('No embedding values in Vertex AI response');
      }

      const embeddingResult: EmbeddingResult = {
        embedding: prediction.embeddings.values,
        model: this.model,
        tokensUsed: this.estimateTokenCount(cleanedText)
      };

      this.logger.debug(`Generated embedding for text (${cleanedText.length} chars, ~${embeddingResult.tokensUsed} tokens)`);

      return embeddingResult;

    } catch (error: any) {
      this.logger.error(`Failed to generate embedding: ${error.message}`, error);
      throw new Error(`Vertex AI embedding generation failed: ${error.message}`);
    }
  }

  async generateBatchEmbeddings(texts: string[], taskType?: string): Promise<BatchEmbeddingResult> {
    if (!texts || texts.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    if (texts.length > 100) { // Vertex AI batch limit is typically lower
      throw new Error('Batch size cannot exceed 100 texts for Vertex AI');
    }

    // Clean and prepare texts
    const cleanedTexts = texts.map(text => this.preprocessText(text));
    const validTexts = cleanedTexts.filter(text => text.trim().length > 0);

    if (validTexts.length === 0) {
      throw new Error('No valid texts provided for embedding generation');
    }

    try {
      if (!this.credentials) {
        await this.initializeVertexAI();
      }

      // Use Vertex AI REST API directly for batch embeddings
      const { GoogleAuth } = await import('google-auth-library');

      const auth = new GoogleAuth({
        credentials: {
          client_email: this.credentials.client_email,
          private_key: this.credentials.private_key,
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });

      const accessToken = await auth.getAccessToken();

      // Process texts one by one (gemini-embedding-001 limitation)
      const allEmbeddings: number[][] = [];
      let totalTokens = 0;

      for (const text of validTexts) {
        try {
          const request = {
            instances: [{
              content: text,
              task_type: taskType || 'RETRIEVAL_DOCUMENT'
            }],
            parameters: {
              outputDimensionality: this.outputDimensions
            }
          };

          const response = await fetch(
            `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.credentials.project_id}/locations/us-central1/publishers/google/models/${this.model}:predict`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(request)
            }
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Vertex AI API error: ${error.error?.message || response.statusText}`);
          }

          const result = await response.json();

          if (!result.predictions || result.predictions.length === 0) {
            throw new Error(`No predictions for text: ${text.substring(0, 50)}...`);
          }

          const prediction = result.predictions[0];
          if (!prediction.embeddings || !prediction.embeddings.values) {
            throw new Error(`No embedding values for text: ${text.substring(0, 50)}...`);
          }

          allEmbeddings.push(prediction.embeddings.values);
          totalTokens += this.estimateTokenCount(text);

        } catch (error: any) {
          this.logger.error(`Failed to process text: ${text.substring(0, 50)}...`, error);
          throw error;
        }
      }

      const result: BatchEmbeddingResult = {
        embeddings: allEmbeddings,
        model: this.model,
        totalTokensUsed: totalTokens
      };

      this.logger.log(`Generated ${result.embeddings.length} embeddings (~${result.totalTokensUsed} tokens total)`);

      return result;

    } catch (error: any) {
      this.logger.error(`Failed to generate batch embeddings: ${error.message}`, error);
      throw new Error(`Vertex AI batch embedding generation failed: ${error.message}`);
    }
  }

  async generateEmbeddingForDocument(title: string, content: string): Promise<EmbeddingResult> {
    // Better document processing for higher relevance scores
    // Title gets 3x weight for better topic matching
    const processedText = `${title}\n${title}\n${title}\n\n${content}\n\n${title}`;
    return this.generateEmbedding(processedText, 'RETRIEVAL_DOCUMENT');
  }

  async generateEmbeddingForQuery(query: string): Promise<EmbeddingResult> {
    // Use query-specific task type for better search results
    return this.generateEmbedding(query, 'RETRIEVAL_QUERY');
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      const val1 = embedding1[i]!;
      const val2 = embedding2[i]!;
      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  private preprocessText(text: string): string {
    // Clean and normalize text for better embeddings
    // Gemini-embedding-001 max input is 2048 tokens, so ~6000 characters
    return text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .substring(0, 6000); // Limit to ~2048 tokens for Vertex AI
  }

  // Utility method to chunk large documents (optimized for Vertex AI)
  chunkDocument(content: string, maxChunkSize: number = 1500, overlap: number = 150): string[] {
    if (content.length <= maxChunkSize) {
      return [content];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < content.length) {
      let endIndex = startIndex + maxChunkSize;

      // Try to break at sentence boundary
      if (endIndex < content.length) {
        const lastPeriod = content.lastIndexOf('.', endIndex);
        const lastNewline = content.lastIndexOf('\n', endIndex);
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > startIndex + maxChunkSize * 0.5) {
          endIndex = breakPoint + 1;
        }
      }

      const chunk = content.substring(startIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      startIndex = endIndex - overlap;
      if (startIndex >= content.length) break;
    }

    return chunks;
  }

  // Method to estimate token count (Vertex AI doesn't provide exact count)
  estimateTokenCount(text: string): number {
    // Rough approximation for multilingual text (Russian/Kazakh/English)
    // More conservative than OpenAI due to Cyrillic characters
    return Math.ceil(text.length / 3.5);
  }

  // Method to estimate cost for Vertex AI embeddings
  estimateCost(tokenCount: number): number {
    // Vertex AI pricing is typically per 1000 characters, not tokens
    // gemini-embedding-001: approximately $0.00001 per 1000 characters
    const characterCount = tokenCount * 3.5; // Reverse token estimation
    return (characterCount / 1000) * 0.00001;
  }

  // Get supported task types for different use cases
  getTaskTypes() {
    return {
      RETRIEVAL_QUERY: 'For search queries',
      RETRIEVAL_DOCUMENT: 'For documents in knowledge base',
      SEMANTIC_SIMILARITY: 'For measuring text similarity',
      CODE_RETRIEVAL_QUERY: 'For code search queries'
    };
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const testResult = await this.generateEmbedding('test text');
      return testResult.embedding.length === this.outputDimensions;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }
}