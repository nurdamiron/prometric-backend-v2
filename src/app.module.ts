import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { User, Organization } from './auth/entities/user.entity';
import { validate } from './config/env.validation';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),

    // Database - PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'prometric_v2',
      entities: [User, Organization],
      synchronize: process.env.NODE_ENV === 'development', // Only in dev!
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
        : false,
    }),

    // Business Modules - PHASE 1: ONLY AUTH
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
