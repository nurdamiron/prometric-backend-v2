import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

// Domain imports
import { AuthApplicationService } from './authentication/application/services/auth-application.service';

// Infrastructure imports
import { AuthController } from './authentication/infrastructure/controllers/auth.controller';

// Legacy imports (temporary - will be refactored to DDD)
import { AuthService } from '../../auth/services/auth.service';
import { EmailService } from '../../auth/services/email.service';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { User, Organization, RefreshToken } from '../../auth/entities/user.entity';
import { TestController } from '../../auth/controllers/test.controller';

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
    TestController, // Legacy controller (temporary)
  ],
  providers: [
    // DDD Application Services
    AuthApplicationService,

    // Legacy services (temporary - will be refactored)
    AuthService,
    EmailService,
    JwtStrategy,

    // Shared guards
    OrganizationGuard,
  ],
  exports: [
    AuthService, // Export for other modules (temporary)
    AuthApplicationService, // DDD service
    OrganizationGuard, // Shared guard
  ],
})
export class UserIdentityModule {}