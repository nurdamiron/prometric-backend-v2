import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CqrsModule } from '@nestjs/cqrs';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './domains/user-identity-access/authentication/infrastructure/guards/jwt-auth.guard';
import { OrganizationGuard } from './shared/guards/organization.guard';

// DDD Modules
import { AuthModule } from './domains/user-identity-access/auth.module';
import { AuthorizationModule } from './domains/user-identity-access/authorization/authorization.module';
import { HealthCheckModule } from './domains/system-monitoring/health-check/health-check.module';

// AI Intelligence Domains
import { OrchestrationModule } from './domains/ai-intelligence/orchestration/orchestration.module';
import { ConversationModule } from './domains/ai-intelligence/conversation/conversation.module';
import { LearningModule } from './domains/ai-intelligence/learning/learning.module';
import { KnowledgeManagementModule } from './domains/ai-intelligence/knowledge-management/knowledge-management.module';

// Business Domains
import { CustomerManagementModule } from './domains/customer-relationship-management/customer-lifecycle/customer-management.module';
import { SalesPipelineModule } from './domains/sales-pipeline-management/sales-pipeline.module';
import { DocumentManagementModule } from './domains/document-management/document-lifecycle/document-management.module';

// Entities
import { User, Organization, RefreshToken } from './domains/user-identity-access/authentication/domain/entities/user.entity';
import { CustomerPersistenceEntity } from './domains/customer-relationship-management/customer-lifecycle/infrastructure/persistence/customer.persistence.entity';
import { DocumentPersistenceEntity, DocumentCommentEntity, DocumentAccessLogEntity } from './domains/document-management/document-lifecycle/infrastructure/persistence/document.persistence.entity';
import { PipelinePersistenceEntity, DealPersistenceEntity, DealActivityEntity } from './domains/sales-pipeline-management/deal-lifecycle/infrastructure/persistence/pipeline.persistence.entity';
import { KnowledgeDocumentEntity, DocumentChunkEntity } from './domains/ai-intelligence/knowledge-management/infrastructure/persistence/knowledge-document.entity';
import { ConversationSessionEntity, ConversationMessageEntity } from './domains/ai-intelligence/conversation/infrastructure/persistence/conversation.entity';
import { LearningEventEntity } from './domains/ai-intelligence/learning/infrastructure/persistence/learning.entity';
import { PermissionEntity, RoleEntity, UserPermissionEntity } from './domains/user-identity-access/authorization/infrastructure/persistence/permission.entity';
import { UserRoleEntity } from './domains/user-identity-access/authorization/infrastructure/persistence/user-role.entity';

import { validate } from './config/env.validation';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),

    // Scheduling for cron jobs
    ScheduleModule.forRoot(),

    // Database - PostgreSQL with optimized connection pool
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'prometric_v2',
      entities: [
        // Core Auth Entities (DDD)
        User, Organization, RefreshToken,

        // Authorization Entities (DDD)
        PermissionEntity, RoleEntity, UserRoleEntity, UserPermissionEntity,

        // CRM Domain Entities
        CustomerPersistenceEntity,

        // Document Management Domain Entities
        DocumentPersistenceEntity, DocumentCommentEntity, DocumentAccessLogEntity,

        // Sales Pipeline Domain Entities
        PipelinePersistenceEntity, DealPersistenceEntity, DealActivityEntity,

        // AI Intelligence Domain Entities
        KnowledgeDocumentEntity, DocumentChunkEntity,
        ConversationSessionEntity, ConversationMessageEntity,
        LearningEventEntity
      ],
      synchronize: true, // Temporarily enabled to create missing tables
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.DATABASE_HOST?.includes('rds.amazonaws.com')
        ? { rejectUnauthorized: false } // AWS RDS
        : false,
      // 🚀 PERFORMANCE: Optimized connection pool for high load
      extra: {
        max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum connections
        min: parseInt(process.env.DB_POOL_MIN || '5'),  // Minimum connections
        acquire: 30000, // Maximum time to get connection (30s)
        idle: 10000,    // Time before releasing idle connection (10s)
        evict: 60000,   // Time before removing unused connection (60s)
        handleDisconnects: true, // Reconnect on connection loss
      },
      // 🔧 Basic caching
      cache: {
        duration: 30000, // Cache query results for 30s
      },
      maxQueryExecutionTime: 5000, // Log slow queries (>5s)
      // 🚀 Schema caching to reduce startup time
      schema: process.env.DATABASE_SCHEMA || 'public',
      migrationsRun: false, // Disable auto-migrations in production
      dropSchema: false, // Never drop schema automatically
      // 📈 Basic settings
    }),

    // Global CQRS Module
    CqrsModule.forRoot(),

    // 🏗️ DDD BOUNDED CONTEXTS

    // Core System Modules
    AuthModule, // Authentication with HttpOnly cookies ✅
    AuthorizationModule, // RBAC with DDD + Department isolation ✅
    HealthCheckModule, // Health monitoring with DDD ✅

    // 🧠 AI INTELLIGENCE BOUNDED CONTEXT
    OrchestrationModule, // AI Orchestrator & Main Intelligence Logic ✅
    ConversationModule, // AI Chat Sessions & Context Management ✅
    LearningModule, // Continuous Learning & Insights ✅
    KnowledgeManagementModule, // AI Knowledge Base with pgvector ✅

    // 🏢 BUSINESS DOMAINS
    CustomerManagementModule, // Customer Relationship Management ✅
    SalesPipelineModule, // Sales Pipeline Management ✅
    DocumentManagementModule, // Document Management ✅
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 🔐 GLOBAL GUARDS for security
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Global JWT authentication
    },
    {
      provide: APP_GUARD,
      useClass: OrganizationGuard, // Global organization data isolation
    },
  ],
})
export class AppModule {}
