import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
// import { AiModule } from './ai/ai.module';
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
      // 🔧 Advanced database optimizations
      cache: {
        type: 'database',
        duration: 30000, // Cache query results for 30s
        options: {
          type: 'ioredis', // Use Redis if available
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
      maxQueryExecutionTime: 5000, // Log slow queries (>5s)
      // 🚀 Schema caching to reduce startup time
      schema: process.env.DATABASE_SCHEMA || 'public',
      migrationsRun: false, // Disable auto-migrations in production
      dropSchema: false, // Never drop schema automatically
      // 📈 Performance optimizations
      supportBigNumbers: true,
      bigNumberStrings: false,
      // 🔍 Query optimization
      relationLoadStrategy: 'join', // Use JOIN instead of separate queries
    }),

    // Business Modules - Auth focus for critical testing
    AuthModule,
    // AiModule, // Temporarily disabled due to import errors
    // CustomerManagementModule, // DDD structure complete - temporarily disabled for testing
    // CompleteSalesModule, // Real Sales Pipeline with full database integration - temporarily disabled
    // AnalyticsModule, // Real-time analytics and business intelligence - temporarily disabled
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
