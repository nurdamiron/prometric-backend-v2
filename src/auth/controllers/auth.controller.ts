import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, Query, Req } from '@nestjs/common';
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
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const requestMetadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    return this.authService.login(loginDto, requestMetadata);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string, @Req() req: any) {
    const requestMetadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    return this.authService.refresh(refreshToken, requestMetadata);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    return this.authService.profile(req.user.id);
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
    const exists = await this.authService.emailExists(email);
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

  @Get('company')
  @HttpCode(HttpStatus.OK)
  async company(@Query('bin') bin: string) {
    return this.authService.findCompany(bin);
  }

  // EMAIL VERIFICATION ENDPOINTS
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  async sendCode(
    @Body('email') email: string,
    @Body('language') language?: string
  ) {
    return this.authService.sendCode(email, language);
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  async verifyCode(
    @Body('email') email: string,
    @Body('code') code: string
  ) {
    return this.authService.verifyCode(email, code);
  }

  // ONBOARDING PROGRESS ENDPOINTS
  @Post('progress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async progress(@Request() req: any, @Body() dto: UpdateOnboardingProgressDto) {
    return this.authService.progressOnboarding(req.user.id, dto.onboardingStep, dto.onboardingData);
  }

  @Post('finish')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async finish(@Request() req: any, @Body() dto: CompleteOnboardingDto) {
    return this.authService.finishOnboarding(req.user.id, dto.onboardingData);
  }

  // EMPLOYEE APPROVAL ENDPOINTS
  @Get('pending')
  @UseGuards(JwtAuthGuard)
  async pending(@Request() req: any) {
    return this.authService.pendingEmployees(req.user.id);
  }

  @Post('approve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async approve(@Request() req: any, @Body('employeeId') employeeId: string) {
    return this.authService.approve(req.user.id, employeeId);
  }

  @Post('reject')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async reject(@Request() req: any, @Body() body: { employeeId: string; reason?: string }) {
    return this.authService.reject(req.user.id, body.employeeId, body.reason);
  }

}