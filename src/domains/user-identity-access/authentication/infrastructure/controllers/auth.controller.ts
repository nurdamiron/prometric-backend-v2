import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, Query, Req, Res, Param } from '@nestjs/common';
import { AuthApplicationService } from '../../application/services/auth-application.service';
import { UserCleanupApplicationService } from '../../application/services/user-cleanup.application.service';
// DDD imports
import { RegisterDto, LoginDto } from '../dto/register.dto';
import { UpdateOnboardingProgressDto, CompleteOnboardingDto } from '../dto/onboarding.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OrganizationGuard, SkipOrgGuard } from '../../../../../shared/guards/organization.guard';
import { Public } from '../../../../../shared/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthApplicationService,
    private readonly userCleanupService: UserCleanupApplicationService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const requestMetadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    const result = await this.authService.login(loginDto, requestMetadata);

    // 🔐 Set HttpOnly cookies for secure authentication
    this.authService.setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });

    // Return user data without tokens (tokens are in httpOnly cookies)
    const { accessToken, refreshToken, ...userResponse } = result;
    return userResponse;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    // Get refresh token from httpOnly cookie
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return { success: false, message: 'No refresh token provided' };
    }

    const requestMetadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    const result = await this.authService.refresh(refreshToken, requestMetadata);

    // 🔐 Set new HttpOnly cookies
    this.authService.setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });

    // Return success without tokens
    const { accessToken, refreshToken: newRefreshToken, ...refreshResponse } = result;
    return refreshResponse;
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    return this.authService.profile(req.user.id);
  }

  // 🔐 USER HYDRATION endpoint for HttpOnly cookie authentication
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipOrgGuard() // Skip org guard for user profile endpoint
  async getCurrentUser(@Request() req: any) {
    const user = await this.authService.profile(req.user.id);
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
        onboardingStep: user.onboardingStep,
        aiConfig: user.aiConfig
      }
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any, @Res({ passthrough: true }) res: any) {
    const result = await this.authService.logout(req.user.id);

    // 🧹 Clear HttpOnly cookies
    this.authService.clearAuthCookies(res);

    return result;
  }

  // VALIDATION ENDPOINTS
  @Public()
  @Get('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmailExists(@Query('email') email: string) {
    const exists = await this.authService.emailExists(email);
    return {
      exists,
      message: exists ? 'Email already registered' : 'Email available'
    };
  }

  @Public()
  @Post('validate-password')
  @HttpCode(HttpStatus.OK)
  async validatePassword(@Body('password') password: string) {
    return this.authService.validatePassword(password);
  }

  @Public()
  @Get('company')
  @HttpCode(HttpStatus.OK)
  async company(@Query('bin') bin: string) {
    return this.authService.findCompany(bin);
  }

  // EMAIL VERIFICATION ENDPOINTS
  @Public()
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  async sendCode(
    @Body('email') email: string,
    @Body('language') language?: string
  ) {
    return this.authService.sendCode(email, language);
  }

  @Public()
  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  async verifyCode(
    @Body('email') email: string,
    @Body('code') code: string,
    @Res({ passthrough: true }) res: any
  ) {
    const result = await this.authService.verifyCode(email, code);
    
    // 🔐 Set HttpOnly cookies if verification successful
    if (result.success && result.accessToken && result.refreshToken) {
      this.authService.setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
      
      // Return user data without tokens (tokens are in httpOnly cookies)
      const { accessToken, refreshToken, ...userResponse } = result;
      return userResponse;
    }
    
    return result;
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

  // 🔓 PUBLIC ONBOARDING ENDPOINTS (for non-authenticated users during onboarding)
  @Public()
  @Post('onboarding/progress')
  @HttpCode(HttpStatus.OK)
  async publicProgress(
    @Body() dto: UpdateOnboardingProgressDto & { email: string }
  ) {
    // Find user by email and verify they're in onboarding process
    const user = await this.authService.findUserByEmailForOnboarding(dto.email);
    if (!user || !user.emailVerified) {
      throw new Error('User not found or email not verified');
    }
    return this.authService.progressOnboarding(user.id, dto.onboardingStep, dto.onboardingData);
  }

  @Public()
  @Post('onboarding/finish')
  @HttpCode(HttpStatus.OK)
  async publicFinish(
    @Body() dto: CompleteOnboardingDto & { email: string },
    @Res({ passthrough: true }) res: any
  ) {
    // Find user by email and verify they're in onboarding process
    const user = await this.authService.findUserByEmailForOnboarding(dto.email);
    if (!user || !user.emailVerified) {
      throw new Error('User not found or email not verified');
    }

    const result = await this.authService.finishOnboarding(user.id, dto.onboardingData);

    // 🔐 Set HttpOnly cookies after successful onboarding completion
    if (result.success && result.accessToken && result.refreshToken) {
      this.authService.setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });

      // Return user data without tokens (tokens are in httpOnly cookies)
      const { accessToken, refreshToken, ...userResponse } = result;
      return userResponse;
    }

    return result;
  }

  // EMPLOYEE APPROVAL ENDPOINTS - Protected by OrgGuard
  @Get('pending')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  async pending(@Request() req: any) {
    return this.authService.pendingEmployees(req.user.id);
  }

  @Post('approve')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @HttpCode(HttpStatus.OK)
  async approve(@Request() req: any, @Body('employeeId') employeeId: string) {
    return this.authService.approve(req.user.id, employeeId);
  }

  @Post('reject')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @HttpCode(HttpStatus.OK)
  async reject(@Request() req: any, @Body() body: { employeeId: string; reason?: string }) {
    return this.authService.reject(req.user.id, body.employeeId, body.reason);
  }

  // 🧹 USER CLEANUP ENDPOINTS (DDD Architecture)
  @Post('admin/cleanup-incomplete-onboarding')
  @HttpCode(HttpStatus.OK)
  async cleanupIncompleteOnboarding(@Body() body: { timeoutSeconds?: number }) {
    return this.userCleanupService.executeCleanup(body.timeoutSeconds);
  }

  @Get('admin/cleanup-preview')
  @HttpCode(HttpStatus.OK)
  async getCleanupPreview(@Query('timeoutSeconds') timeoutSeconds?: string) {
    const timeout = timeoutSeconds ? parseInt(timeoutSeconds) : undefined;
    return this.userCleanupService.getCleanupPreview(timeout);
  }

  // 🧪 TEST ENDPOINT - Get verification code for testing (development only)
  @Public()
  @Get('test/verification-code/:email')
  @HttpCode(HttpStatus.OK)
  async getVerificationCodeForTesting(@Param('email') email: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints not available in production');
    }

    return this.authService.getVerificationCodeForTesting(email);
  }

}