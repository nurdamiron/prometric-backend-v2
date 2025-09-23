import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, Query } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto } from '../dto/register.dto';
import { UpdateOnboardingProgressDto, CompleteOnboardingDto } from '../dto/onboarding.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.id);
  }

  // VALIDATION ENDPOINTS
  @Get('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmailExists(@Query('email') email: string) {
    const exists = await this.authService.checkEmailExists(email);
    return {
      exists,
      message: exists ? 'Email already registered' : 'Email available'
    };
  }

  @Post('validate-password')
  @HttpCode(HttpStatus.OK)
  async validatePassword(@Body('password') password: string) {
    return this.authService.validatePassword(password);
  }

  @Get('search-company')
  @HttpCode(HttpStatus.OK)
  async searchCompany(@Query('bin') bin: string) {
    return this.authService.searchCompanyByBin(bin);
  }

  // EMAIL VERIFICATION ENDPOINTS
  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  async sendVerificationCode(
    @Body('email') email: string,
    @Body('language') language?: string
  ) {
    return this.authService.sendVerificationCode(email, language);
  }

  @Post('verify-email-code')
  @HttpCode(HttpStatus.OK)
  async verifyEmailCode(
    @Body('email') email: string,
    @Body('code') code: string
  ) {
    return this.authService.verifyEmailCode(email, code);
  }

  // ONBOARDING PROGRESS ENDPOINTS
  @Post('update-onboarding-progress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateOnboardingProgress(@Request() req: any, @Body() dto: UpdateOnboardingProgressDto) {
    return this.authService.updateOnboardingProgress(req.user.id, dto.onboardingStep, dto.onboardingData);
  }

  @Post('complete-onboarding')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(@Request() req: any, @Body() dto: CompleteOnboardingDto) {
    return this.authService.completeOnboarding(req.user.id, dto.onboardingData);
  }
}