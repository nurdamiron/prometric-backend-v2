import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './domains/user-identity-access/auth.module'; // DDD Auth Module
// import { AuthModule as LegacyAuthModule } from './auth/auth.module'; // Legacy - replaced by DDD

// 🧠 NEW AI BRAIN DDD DOMAINS
import { OrchestrationModule } from './domains/ai-intelligence/orchestration/orchestration.module';
import { ConversationModule } from './domains/ai-intelligence/conversation/conversation.module';
import { LearningModule } from './domains/ai-intelligence/learning/learning.module';
import { User, Organization, RefreshToken } from './domains/user-identity-access/authentication/domain/entities/user.entity';
// import { SalesPipeline, SalesStage, SalesDeal } from './entities/sales-pipeline.entity';
import { CustomerPersistenceEntity } from './domains/customer-relationship-management/customer-lifecycle/infrastructure/persistence/customer.persistence.entity';
import { CustomerManagementModule } from './domains/customer-relationship-management/customer-lifecycle/customer-management.module';
import { SalesPipelineModule } from './domains/sales-pipeline-management/sales-pipeline.module';
import { KnowledgeManagementModule } from './domains/ai-intelligence/knowledge-management/knowledge-management.module';
import { KnowledgeDocumentEntity, DocumentChunkEntity } from './domains/ai-intelligence/knowledge-management/infrastructure/persistence/knowledge-document.entity';

// AI Intelligence Domain Entities
import { ConversationSessionEntity, ConversationMessageEntity } from './domains/ai-intelligence/conversation/infrastructure/persistence/conversation.entity';
import { LearningEventEntity } from './domains/ai-intelligence/learning/infrastructure/persistence/learning.entity';
// import { CompleteSalesModule } from './modules/complete-sales.module';
// import { AnalyticsModule } from './modules/analytics.module';
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
        // CRM Domain Entities
        CustomerPersistenceEntity,
        // AI Intelligence Domain Entities
        KnowledgeDocumentEntity, DocumentChunkEntity,
        ConversationSessionEntity, ConversationMessageEntity,
        LearningEventEntity
      ],
      synchronize: false, // Disabled due to entity conflicts
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

    // 🏗️ DDD DOMAINS (Removed due to TypeScript errors - need proper implementation)
    // UserIdentityModule, // Need to fix imports and dependencies
    // KnowledgeManagementModule, // Need to fix cheerio dependencies and imports

    // 🔧 STABLE MODULES (WORKING)
    AuthModule, // Auth module with HttpOnly cookies support ✅

    // 🧠 AI INTELLIGENCE BOUNDED CONTEXT (DDD)
    OrchestrationModule, // AI Orchestrator & Main Intelligence Logic ✅
    ConversationModule, // AI Chat Sessions & Context Management ✅
    LearningModule, // Continuous Learning & Insights ✅
    KnowledgeManagementModule, // AI Knowledge Base with pgvector ✅

    // 🏢 BUSINESS DOMAINS (DDD)
    CustomerManagementModule, // Customer Relationship Management CORE DOMAIN ✅
    SalesPipelineModule, // Sales Pipeline Management CORE DOMAIN ✅


    // AnalyticsModule, // Will migrate to Analytics domain
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
