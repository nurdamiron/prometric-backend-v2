// Memory Health Checker - Infrastructure Layer
import { Injectable } from '@nestjs/common';
import { HealthChecker } from '../../domain/services/health-check-domain.service';
import { ComponentHealth } from '../../domain/entities/system-health.entity';
import { HealthStatus } from '../../domain/value-objects/health-status.vo';

@Injectable()
export class MemoryHealthChecker implements HealthChecker {
  public readonly name = 'memory';

  async check(): Promise<ComponentHealth> {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsed = memoryUsage.heapUsed;
      const heapTotal = memoryUsage.heapTotal;
      const rss = memoryUsage.rss;

      // Конвертируем в MB для удобства
      const heapUsedMB = Math.round(heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(heapTotal / 1024 / 1024);
      const rssMB = Math.round(rss / 1024 / 1024);

      // Вычисляем процент использования heap
      const heapUsagePercent = (heapUsed / heapTotal) * 100;

      // Определяем статус на основе использования памяти
      let status: HealthStatus;
      let message: string;

      if (heapUsagePercent > 90 || rssMB > 1000) { // 90% heap или более 1GB RSS
        status = HealthStatus.unhealthy();
        message = `High memory usage: ${heapUsagePercent.toFixed(1)}% heap, ${rssMB}MB RSS`;
      } else if (heapUsagePercent > 75 || rssMB > 500) { // 75% heap или более 500MB RSS
        status = HealthStatus.degraded();
        message = `Elevated memory usage: ${heapUsagePercent.toFixed(1)}% heap, ${rssMB}MB RSS`;
      } else {
        status = HealthStatus.healthy();
        message = `Memory usage normal: ${heapUsagePercent.toFixed(1)}% heap, ${rssMB}MB RSS`;
      }

      return {
        name: this.name,
        status,
        message,
        lastChecked: new Date()
      };

    } catch (error) {
      return {
        name: this.name,
        status: HealthStatus.unhealthy(),
        message: error instanceof Error ? error.message : 'Memory check failed',
        lastChecked: new Date()
      };
    }
  }
}