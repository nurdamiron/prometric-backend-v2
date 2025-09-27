// Database Health Checker - Infrastructure Layer
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthChecker } from '../../domain/services/health-check-domain.service';
import { ComponentHealth } from '../../domain/entities/system-health.entity';
import { HealthStatus } from '../../domain/value-objects/health-status.vo';

@Injectable()
export class DatabaseHealthChecker implements HealthChecker {
  public readonly name = 'database';

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  async check(): Promise<ComponentHealth> {
    try {
      if (!this.dataSource.isInitialized) {
        return {
          name: this.name,
          status: HealthStatus.unhealthy(),
          message: 'Database connection not initialized',
          lastChecked: new Date()
        };
      }

      // Простой health check query
      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      // Проверяем что connection активно
      const isConnected = this.dataSource.isInitialized;

      if (!isConnected) {
        return {
          name: this.name,
          status: HealthStatus.degraded(),
          responseTime,
          message: 'Database connection not ready',
          lastChecked: new Date()
        };
      }

      // Медленные запросы считаем degraded
      if (responseTime > 1000) {
        return {
          name: this.name,
          status: HealthStatus.degraded(),
          responseTime,
          message: `Slow database response: ${responseTime}ms`,
          lastChecked: new Date()
        };
      }

      return {
        name: this.name,
        status: HealthStatus.healthy(),
        responseTime,
        message: 'Database connection is healthy',
        lastChecked: new Date()
      };

    } catch (error) {
      return {
        name: this.name,
        status: HealthStatus.unhealthy(),
        message: error instanceof Error ? error.message : 'Database check failed',
        lastChecked: new Date()
      };
    }
  }
}