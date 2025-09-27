import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VertexAI } from '@google-cloud/vertexai';

export interface VertexAIMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface VertexAIRequest {
  model: string;
  messages: VertexAIMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  functions?: any[];
}

export interface VertexAIResponse {
  content: string;
  role: 'model';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  functionCalls?: any[];
}

@Injectable()
export class VertexAIService {
  private readonly logger = new Logger(VertexAIService.name);
  private vertexAI: VertexAI;
  private readonly projectId: string;
  private readonly location: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID', '');
    this.location = this.configService.get<string>('GOOGLE_CLOUD_LOCATION', 'us-central1');

    // Check if Vertex AI is properly configured
    this.isConfigured = Boolean(this.projectId);

    if (this.isConfigured) {
      try {
        this.vertexAI = new VertexAI({
          project: this.projectId,
          location: this.location,
        });
        this.logger.log(`✅ Vertex AI initialized for project: ${this.projectId}`);
      } catch (error) {
        this.logger.error('❌ Failed to initialize Vertex AI:', (error as Error).message);
        this.isConfigured && (this.isConfigured as any) && false;
      }
    } else {
      this.logger.warn('⚠️ Vertex AI not configured - missing GOOGLE_CLOUD_PROJECT_ID');
    }
  }

  async generateText(request: VertexAIRequest): Promise<VertexAIResponse> {
    if (!this.isConfigured) {
      throw new Error('Vertex AI is not configured. Please set GOOGLE_CLOUD_PROJECT_ID and ensure service account credentials are available.');
    }

    try {
      this.logger.debug('🤖 Sending request to Vertex AI:', {
        model: request.model,
        messageCount: request.messages.length,
        temperature: request.temperature || 0.7
      });

      const model = this.vertexAI.preview.getGenerativeModel({
        model: request.model || 'gemini-2.5-flash',
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 8192,
          topP: request.topP || 0.95,
          topK: request.topK || 40,
        },
      });

      // Convert messages to Vertex AI format
      const chatHistory = request.messages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: msg.parts
      }));

      const lastMessage = request.messages[request.messages.length - 1];

      if (!lastMessage || !lastMessage.parts || !lastMessage.parts[0]) {
        throw new Error('Invalid message format');
      }

      let result;
      if (chatHistory.length > 0) {
        // Continue existing conversation
        const chat = model.startChat({
          history: chatHistory
        });
        result = await chat.sendMessage(lastMessage.parts[0].text);
      } else {
        // Start new conversation
        result = await model.generateContent(lastMessage.parts[0].text);
      }

      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      this.logger.debug('✅ Received response from Vertex AI:', {
        contentLength: text.length,
        candidateCount: response.candidates?.length || 0
      });

      return {
        content: text,
        role: 'model',
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0
        }
      };

    } catch (error) {
      this.logger.error('❌ Vertex AI API error:', {
        message: (error as Error).message,
        stack: (error as Error).stack
      });

      // Return a fallback response instead of throwing
      return {
        content: 'Извините, сейчас я временно недоступен. Попробуйте позже или обратитесь к администратору.',
        role: 'model',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isConfigured) {
      throw new Error('Vertex AI is not configured for embeddings');
    }

    try {
      this.logger.debug('🔍 Generating embedding for text:', {
        textLength: text.length,
        preview: text.substring(0, 100) + '...'
      });

      // Note: Vertex AI embeddings would require a different API
      // For now, we'll use a mock embedding or integrate with OpenAI
      this.logger.warn('⚠️ Embedding generation not yet implemented for Vertex AI');

      // Return mock embedding for now
      return new Array(1536).fill(0).map(() => Math.random() - 0.5);

    } catch (error) {
      this.logger.error('❌ Embedding generation error:', (error as Error).message);
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; configured: boolean; project?: string }> {
    try {
      if (!this.isConfigured) {
        return {
          status: 'not_configured',
          configured: false
        };
      }

      // Try a simple API call to check connectivity
      const model = this.vertexAI.preview.getGenerativeModel({
        model: 'gemini-2.5-flash'
      });

      const result = await model.generateContent('Hello');
      const response = result.response;

      return {
        status: response.candidates?.[0]?.content?.parts?.[0]?.text ? 'healthy' : 'error',
        configured: true,
        project: this.projectId
      };

    } catch (error) {
      this.logger.error('❌ Vertex AI health check failed:', (error as Error).message);
      return {
        status: 'error',
        configured: this.isConfigured,
        project: this.projectId
      };
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }

  getConfiguration(): { projectId: string; location: string; configured: boolean } {
    return {
      projectId: this.projectId,
      location: this.location,
      configured: this.isConfigured
    };
  }
}