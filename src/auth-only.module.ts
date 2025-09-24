import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { User, Organization, RefreshToken } from './auth/entities/user.entity';
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
      entities: [User, Organization, RefreshToken], // Auth entities only
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.DATABASE_HOST?.includes('rds.amazonaws.com')
        ? { rejectUnauthorized: false }
        : false,
      // 🚀 PERFORMANCE: Optimized connection pool for high load
      extra: {
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        min: parseInt(process.env.DB_POOL_MIN || '5'),
        acquire: 30000,
        idle: 10000,
        evict: 60000,
        handleDisconnects: true,
      },
      cache: {
        duration: 30000,
      },
      maxQueryExecutionTime: 5000,
    }),

    // Core Auth Module Only
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AuthOnlyModule {}