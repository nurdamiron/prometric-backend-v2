import { Controller, Post, Body, Get } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus, OnboardingStep } from '../entities/user.entity';

@Controller('test')
export class TestController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Post('activate-user')
  async activateUser(@Body('email') email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return { error: 'User not found' };
    }

    // Bypass email verification
    await this.userRepository.update(user.id, {
      status: UserStatus.ACTIVE,
      onboardingStep: OnboardingStep.THEME,
      verificationCode: undefined,
      verificationExpiresAt: undefined
    });

    // Generate fresh tokens
    const tokens = await (this.authService as any).generateTokens(user);

    return {
      success: true,
      message: 'User activated for testing',
      userId: user.id,
      ...tokens
    };
  }

  @Get('user-data')
  async getUserData(@Body('email') email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return { error: 'User not found' };
    }

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      onboardingStep: user.onboardingStep,
      registrationData: user.registrationData,
      aiConfig: user.aiConfig,
      verificationCode: user.verificationCode
    };
  }
}