import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './controllers/auth.controller';
import { TestController } from './controllers/test.controller';
import { AuthService } from './services/auth.service';
import { EmailService } from './services/email.service';
import { User, Organization } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController, TestController],
  providers: [AuthService, EmailService, JwtAuthGuard, JwtStrategy],
  exports: [AuthService, EmailService, JwtAuthGuard, JwtStrategy],
})
export class AuthModule {}