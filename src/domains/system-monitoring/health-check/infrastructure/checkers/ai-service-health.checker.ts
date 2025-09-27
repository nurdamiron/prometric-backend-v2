// AI Service Health Checker - Infrastructure Layer
import { Injectable } from '@nestjs/common';
import { HealthChecker } from '../../domain/services/health-check-domain.service';
import { ComponentHealth } from '../../domain/entities/system-health.entity';
import { HealthStatus } from '../../domain/value-objects/health-status.vo';

@Injectable()
export class AIServiceHealthChecker implements HealthChecker {
  public readonly name = 'ai-service';

  async check(): Promise<ComponentHealth> {
    try {
      // Проверяем есть ли OpenAI API ключ
      const openAiKey = process.env.OPENAI_API_KEY;
      if (!openAiKey) {
        return {
          name: this.name,
          status: HealthStatus.unhealthy(),
          message: 'OpenAI API key not configured',
          lastChecked: new Date()
        };
      }

      // Простая проверка API доступности (без реального запроса)
      const startTime = Date.now();

      // Проверяем что ключ имеет правильный формат
      if (!openAiKey.startsWith('sk-') || openAiKey.length < 20) {
        return {
          name: this.name,
          status: HealthStatus.degraded(),
          message: 'OpenAI API key format appears invalid',
          lastChecked: new Date()
        };
      }

      const responseTime = Date.now() - startTime;

      // Проверяем другие AI-related переменные
      const vertexProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      const hasVertexConfig = !!vertexProjectId;

      let message = 'AI services configured';
      if (hasVertexConfig) {
        message += ' (OpenAI + Vertex AI)';
      } else {
        message += ' (OpenAI only)';
      }

      return {
        name: this.name,
        status: HealthStatus.healthy(),
        responseTime,
        message,
        lastChecked: new Date()
      };

    } catch (error) {
      return {
        name: this.name,
        status: HealthStatus.unhealthy(),
        message: error instanceof Error ? error.message : 'AI service check failed',
        lastChecked: new Date()
      };
    }
  }
}