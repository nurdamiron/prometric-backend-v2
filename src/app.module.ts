import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserIdentityModule } from './domains/user-identity-access/user-identity.module';
import { AiModule } from './ai/ai.module';
import { User, Organization, RefreshToken } from './auth/entities/user.entity';
// import { SalesPipeline, SalesStage, SalesDeal } from './entities/sales-pipeline.entity';
// import { CustomerPersistenceEntity } from './domains/customer-relationship-management/customer-lifecycle/infrastructure/persistence/customer.persistence.entity';
// import { CustomerManagementModule } from './domains/customer-relationship-management/customer-lifecycle/customer-management.module';
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

    // Database - PostgreSQL with optimized connection pool
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'prometric_v2',
      entities: [User, Organization, RefreshToken], // Simplified for critical auth testing
      synchronize: process.env.NODE_ENV === 'development', // Only in dev!
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

    // 🏗️ DDD DOMAINS (Gradual migration - currently has 71 TypeScript errors)
    // UserIdentityModule, // User Identity & Access Management domain - temporarily disabled

    // 🔧 Working Modules
    AuthModule, // Auth module with HttpOnly cookies support
    AiModule, // AI Intelligence module with Kazakhstan localization
    // CustomerManagementModule, // Will migrate to CRM domain
    // CompleteSalesModule, // Will migrate to Sales Pipeline domain
    // AnalyticsModule, // Will migrate to Analytics domain
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
