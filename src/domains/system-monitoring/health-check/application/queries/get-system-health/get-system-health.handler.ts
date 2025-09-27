// Get System Health Query Handler - CQRS Pattern
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetSystemHealthQuery } from './get-system-health.query';
import { HealthCheckDomainService } from '../../../domain/services/health-check-domain.service';
import { SystemHealth } from '../../../domain/entities/system-health.entity';

@QueryHandler(GetSystemHealthQuery)
export class GetSystemHealthHandler implements IQueryHandler<GetSystemHealthQuery, any> {
  constructor(
    private readonly healthCheckDomainService: HealthCheckDomainService
  ) {}

  async execute(query: GetSystemHealthQuery): Promise<any> {
    const version = process.env.npm_package_version || '1.0.0';
    const systemHealth = await this.healthCheckDomainService.performHealthCheck(version);

    if (query.includeDetails) {
      return systemHealth.toApiResponse();
    }

    // Simple status check without details
    return {
      status: systemHealth.getOverallStatus().getValue(),
      timestamp: systemHealth.getTimestamp().toISOString(),
      uptime: systemHealth.getUptime()
    };
  }
}