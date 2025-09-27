import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

// Domain imports
import { AuthApplicationService } from './authentication/application/services/auth-application.service';
import { UserCleanupDomainService } from './authentication/domain/services/user-cleanup.domain.service';
import { UserCleanupApplicationService } from './authentication/application/services/user-cleanup.application.service';
import { CompanyDataService } from './authentication/application/services/company-data.service';

// Authorization domain
import { AuthorizationModule } from './authorization/authorization.module';

// Infrastructure imports
import { AuthController } from './authentication/infrastructure/controllers/auth.controller';

// DDD Infrastructure imports
import { EmailService } from './authentication/infrastructure/services/email.service';
import { JwtStrategy } from './authentication/infrastructure/strategies/jwt.strategy';
import { User, Organization, RefreshToken } from './authentication/domain/entities/user.entity';
// Legacy imports removed - full DDD migration complete

// Shared imports
import { OrganizationGuard } from '../../shared/guards/organization.guard';

@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([User, Organization, RefreshToken]),

    // JWT configuration
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret-for-dev',
        signOptions: {
          expiresIn: '15m',
          algorithm: 'HS256'
        },
      }),
    }),

    // Passport configuration
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [
    AuthController, // DDD infrastructure layer
  ],
  providers: [
    // DDD Application Services
    AuthApplicationService,
    UserCleanupApplicationService,
    CompanyDataService,

    // DDD Domain Services
    UserCleanupDomainService,

    // DDD Infrastructure Services
    EmailService,
    JwtStrategy,

    // Shared guards
    OrganizationGuard,
  ],
  exports: [
    AuthApplicationService, // DDD service
    UserCleanupApplicationService, // DDD cleanup service
    OrganizationGuard, // Shared guard
    JwtStrategy, // JWT strategy for other modules
  ],
})
export class AuthModule {}