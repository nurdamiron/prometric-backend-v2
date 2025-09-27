// Health Check Domain Service - DDD Pattern
import { Injectable, Logger } from '@nestjs/common';
import { SystemHealth, ComponentHealth } from '../entities/system-health.entity';
import { HealthStatus } from '../value-objects/health-status.vo';

export interface HealthChecker {
  name: string;
  check(): Promise<ComponentHealth>;
}

@Injectable()
export class HealthCheckDomainService {
  private readonly logger = new Logger(HealthCheckDomainService.name);
  private readonly checkers: HealthChecker[] = [];

  public registerChecker(checker: HealthChecker): void {
    this.checkers.push(checker);
    this.logger.log(`Registered health checker: ${checker.name}`);
  }

  public async performHealthCheck(version: string): Promise<SystemHealth> {
    const startTime = Date.now();
    this.logger.log('Starting health check...');

    const componentResults = await Promise.allSettled(
      this.checkers.map(checker => this.checkComponent(checker))
    );

    const components = componentResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: this.checkers[index]?.name || 'unknown',
          status: HealthStatus.unhealthy(),
          message: `Health check failed: ${result.reason?.message || 'Unknown error'}`,
          lastChecked: new Date()
        };
      }
    });

    const uptime = process.uptime();
    const systemHealth = SystemHealth.create(components, uptime, version);

    const duration = Date.now() - startTime;
    this.logger.log(`Health check completed in ${duration}ms. Status: ${systemHealth.getOverallStatus().getValue()}`);

    return systemHealth;
  }

  private async checkComponent(checker: HealthChecker): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const result = await checker.check();
      const responseTime = Date.now() - startTime;

      return {
        ...result,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: checker.name,
        status: HealthStatus.unhealthy(),
        responseTime,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      };
    }
  }

  public getRegisteredCheckers(): string[] {
    return this.checkers.map(checker => checker.name);
  }
}