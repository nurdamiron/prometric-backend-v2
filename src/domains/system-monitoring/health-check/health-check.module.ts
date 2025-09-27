// Health Check Module - DDD Clean Architecture
import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Domain Services
import { HealthCheckDomainService } from './domain/services/health-check-domain.service';

// Application - Query Handlers
import { GetSystemHealthHandler } from './application/queries/get-system-health/get-system-health.handler';

// Infrastructure - Health Checkers
import { DatabaseHealthChecker } from './infrastructure/checkers/database-health.checker';
import { MemoryHealthChecker } from './infrastructure/checkers/memory-health.checker';
import { AIServiceHealthChecker } from './infrastructure/checkers/ai-service-health.checker';

// Interface - Controllers
import { HealthController } from './interface/health.controller';

const QueryHandlers = [GetSystemHealthHandler];
const HealthCheckers = [
  DatabaseHealthChecker,
  MemoryHealthChecker,
  AIServiceHealthChecker,
];

@Module({
  imports: [CqrsModule],
  providers: [
    // Domain Services
    HealthCheckDomainService,

    // Query Handlers
    ...QueryHandlers,

    // Health Checkers
    ...HealthCheckers,
  ],
  controllers: [HealthController],
  exports: [HealthCheckDomainService],
})
export class HealthCheckModule implements OnModuleInit {
  constructor(
    private readonly healthCheckDomainService: HealthCheckDomainService,
    private readonly databaseHealthChecker: DatabaseHealthChecker,
    private readonly memoryHealthChecker: MemoryHealthChecker,
    private readonly aiServiceHealthChecker: AIServiceHealthChecker
  ) {}

  onModuleInit() {
    // Регистрируем все health checkers
    this.healthCheckDomainService.registerChecker(this.databaseHealthChecker);
    this.healthCheckDomainService.registerChecker(this.memoryHealthChecker);
    this.healthCheckDomainService.registerChecker(this.aiServiceHealthChecker);
  }
}