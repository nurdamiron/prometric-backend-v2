import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { User, UserRole, UserStatus, Organization, OnboardingStep, RefreshToken } from '../../domain/entities/user.entity';
import { UserAggregate } from '../../domain/entities/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { StrongPassword } from '../../domain/value-objects/strong-password.vo';
import { UserRole as UserRoleVO } from '../../domain/value-objects/user-role.vo';

// DDD imports
import { RegisterDto, LoginDto } from '../../infrastructure/dto/register.dto';
import { OnboardingDataDto, UpdateOnboardingProgressDto, CompleteOnboardingDto } from '../../infrastructure/dto/onboarding.dto';
import { EmailService } from '../../infrastructure/services/email.service';
import { CompanyDataService } from './company-data.service';

/**
 * DDD Application Service: Authentication Orchestration
 * Coordinates domain logic, infrastructure services, and external integrations
 * Implements all functionality from legacy AuthService using DDD principles
 */
@Injectable()
export class AuthApplicationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,

    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly companyDataService: CompanyDataService,
  ) {}

  // 📝 COMMAND: Register User
  async register(registerDto: RegisterDto) {
    return await this.userRepository.manager.transaction(async transactionalEntityManager => {
      // Check if user already exists
      const existingUser = await transactionalEntityManager.findOne(User, {
        where: { email: registerDto.email }
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
      const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Sanitize input to prevent XSS
      const sanitizedData = {
        email: registerDto.email.toLowerCase().trim(),
        firstName: this.sanitizeInput(registerDto.firstName),
        lastName: this.sanitizeInput(registerDto.lastName),
        phone: registerDto.phone ? this.sanitizeInput(registerDto.phone) : undefined,
        companyBin: registerDto.companyBin ? this.sanitizeInput(registerDto.companyBin) : undefined,
        companyName: registerDto.companyName ? this.sanitizeInput(registerDto.companyName) : undefined,
        industry: registerDto.industry ? this.sanitizeInput(registerDto.industry) : undefined
      };

      // Create user entity
      const user = transactionalEntityManager.create(User, {
        id: uuidv4(),
        email: sanitizedData.email,
        firstName: sanitizedData.firstName,
        lastName: sanitizedData.lastName,
        password: hashedPassword,
        phone: sanitizedData.phone,
        status: UserStatus.PENDING,
        onboardingStep: OnboardingStep.EMAIL_VERIFICATION,
        verificationCode,
        verificationExpiresAt,
        registrationData: {
          firstName: sanitizedData.firstName,
          lastName: sanitizedData.lastName,
          phone: sanitizedData.phone,
          companyBin: sanitizedData.companyBin,
          companyName: sanitizedData.companyName,
          industry: sanitizedData.industry
        }
      });

      // Save user
      const savedUser = await transactionalEntityManager.save(User, user);

      // Send verification email
      try {
        await this.emailService.sendVerificationCode(savedUser.email, verificationCode);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails, user can request new code
      }

      return {
        user: {
          id: savedUser.id,
          email: savedUser.email,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          status: savedUser.status,
          onboardingStep: savedUser.onboardingStep
        },
        message: 'Registration successful. Please check your email for verification code.',
        needsVerification: true
      };
    });
  }

  // 📝 COMMAND: Login User
  async login(loginDto: LoginDto, requestMetadata?: {
    ipAddress?: string;
    userAgent?: string;
  }) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email }
    });

    if (!user) {
      // Timing attack protection
      await bcrypt.hash('dummy-password', 12);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lock
    if (user.isAccountLocked()) {
      const lockTimeRemaining = Math.ceil((user.lockedUntil!.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Account locked. Try again in ${lockTimeRemaining} minutes.`);
    }

    // Verify password
    const passwordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordValid) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      }
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    user.lastLoginIp = requestMetadata?.ipAddress;

    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user, requestMetadata);

    // Load organization if exists
    let organization = null;
    if (user.organizationId) {
      organization = await this.organizationRepository.findOne({
        where: { id: user.organizationId }
      });
    }

    return {
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
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer',
      organization
    };
  }

  // 📝 COMMAND: Verify Email
  async verifyCode(email: string, code: string): Promise<{
    success: boolean;
    message: string;
    user?: any;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
  }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    if (!user.verificationCode || user.verificationCode !== code) {
      return { success: false, message: 'Invalid verification code' };
    }

    if (!user.verificationExpiresAt || user.verificationExpiresAt < new Date()) {
      return { success: false, message: 'Verification code has expired' };
    }

    // Mark email as verified and generate tokens for onboarding flow
    user.status = UserStatus.PENDING;  // Keep PENDING until onboarding completes
    user.emailVerified = true;  // Mark email as verified
    user.verificationCode = undefined;
    user.verificationExpiresAt = undefined;
    user.onboardingStep = OnboardingStep.THEME;

    await this.userRepository.save(user);

    // Generate tokens for authenticated onboarding flow
    const tokens = await this.generateTokens(user);

    return {
      success: true,
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        onboardingStep: user.onboardingStep
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer'
    };
  }

  // 📝 COMMAND: Send Verification Code
  async sendCode(email: string, language: string = 'ru'): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    user.verificationCode = verificationCode;
    user.verificationExpiresAt = verificationExpiresAt;

    await this.userRepository.save(user);

    try {
      await this.emailService.sendVerificationCode(email, verificationCode, language);
      return { success: true, message: 'Verification code sent successfully' };
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return { success: false, message: 'Failed to send verification code' };
    }
  }

  // 📝 QUERY: Check Email Exists
  async emailExists(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { email } });
    return !!user;
  }

  // 📝 QUERY: Validate Password
  async validatePassword(password: string) {
    const checks = {
      minLength: password.length >= 8,
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    const score = Object.values(checks).filter(Boolean).length;
    const maxScore = Object.keys(checks).length;

    return {
      isValid: score === maxScore,
      checks,
      score,
      maxScore
    };
  }

  // 📝 HELPER: Generate JWT Tokens
  private async generateTokens(user: User, requestMetadata?: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      onboardingStep: user.onboardingStep
    };

    const jti = uuidv4();
    const accessToken = this.jwtService.sign(payload, { jwtid: jti });
    const refreshToken = uuidv4();

    // Store refresh token
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const refreshTokenEntity = this.refreshTokenRepository.create({
      tokenHash: hashedRefreshToken,
      userId: user.id,
      jti: jti,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return { accessToken, refreshToken };
  }

  // 📝 HELPER: Sanitize Input
  private sanitizeInput(value: string): string {
    if (!value || typeof value !== 'string') return value;
    return value
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }


  // 📝 COMMAND: Refresh Token
  async refresh(refreshToken: string, requestMetadata?: any) {
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { tokenHash: hashedToken }
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({ where: { id: tokenRecord.userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user, requestMetadata);

    // Remove old refresh token
    await this.refreshTokenRepository.remove(tokenRecord);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
        onboardingStep: user.onboardingStep
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer'
    };
  }

  // 📝 QUERY: Get User Profile
  async profile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId,
      onboardingStep: user.onboardingStep,
      aiConfig: user.aiConfig
    };
  }

  // 📝 COMMAND: Logout User
  async logout(userId: string) {
    // Remove all refresh tokens for this user
    await this.refreshTokenRepository.delete({ userId });
    return { message: 'Logout successful' };
  }

  // 📝 COMMAND: Progress Onboarding
  async progressOnboarding(userId: string, onboardingStep: OnboardingStep, onboardingData?: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    user.onboardingStep = onboardingStep;
    user.registrationData = {
      ...user.registrationData,
      ...onboardingData
    };

    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Onboarding progress saved',
      onboardingStep: user.onboardingStep
    };
  }

  // 📝 COMMAND: Finish Onboarding
  async finishOnboarding(userId: string, onboardingData: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new Error('Email must be verified before completing onboarding');
    }

    // Update onboarding data
    user.registrationData = { ...user.registrationData, ...onboardingData };
    user.onboardingStep = OnboardingStep.COMPLETED;

    // Get complete user data from all onboarding steps
    const completeUserData = user.registrationData || {};
    console.log('🔍 Complete user registration data:', JSON.stringify(completeUserData, null, 2));

    // Assign role based on user type from registration data
    if (completeUserData.userType === 'owner') {
      user.role = UserRole.OWNER;

      // Create organization for owner
      if (completeUserData.companyBin && completeUserData.companyName) {
        console.log('🏢 Creating organization for owner:', {
          companyBin: completeUserData.companyBin,
          companyName: completeUserData.companyName,
          industry: completeUserData.industry
        });

        const existingOrg = await this.organizationRepository.findOne({
          where: { bin: completeUserData.companyBin }
        });

        if (!existingOrg) {
          const organization = this.organizationRepository.create({
            id: uuidv4(),
            bin: completeUserData.companyBin,
            name: completeUserData.companyName,
            industry: completeUserData.industry || 'Other',
            ownerId: user.id
          });

          const savedOrg = await this.organizationRepository.save(organization);
          user.organizationId = savedOrg.id;
          console.log('✅ Organization created:', savedOrg.id);
        } else {
          // If organization exists, assign user to it
          user.organizationId = existingOrg.id;
          console.log('✅ Organization exists, assigned user to:', existingOrg.id);
        }
      } else {
        console.log('⚠️ No company data provided for organization creation');
      }
    } else if (completeUserData.userType === 'employee') {
      user.role = UserRole.EMPLOYEE;
      user.status = UserStatus.PENDING; // Pending owner approval
    }

    // Activate user after successful onboarding (for owners)
    if (user.role === UserRole.OWNER) {
      user.status = UserStatus.ACTIVE;
    }

    await this.userRepository.save(user);

    // Generate tokens ONLY after onboarding is complete
    let tokens = null;
    if (user.status === UserStatus.ACTIVE) {
      tokens = await this.generateTokens(user);
    }

    return {
      success: true,
      message: 'Onboarding completed successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
        onboardingStep: user.onboardingStep
      },
      ...(tokens && {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 900,
        tokenType: 'Bearer'
      })
    };
  }

  // 📝 QUERY: Find Company (with external data integration)
  async findCompany(bin: string) {
    if (!bin || bin.length !== 12) {
      return { exists: false, message: 'Invalid BIN format' };
    }

    // First, check if company exists in our database
    const organization = await this.organizationRepository.findOne({
      where: { bin }
    });

    if (organization) {
      // Company exists in our system - return with owner info
      const owner = await this.userRepository.findOne({ where: { id: organization.ownerId } });

      return {
        exists: true,
        inSystem: true,
        company: {
          id: organization.id,
          name: organization.name,
          bin: organization.bin,
          industry: organization.industry,
          owner: owner ? {
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email
          } : null
        }
      };
    }

    // Company not in our system - try to fetch from external sources
    const externalCompanyData = await this.companyDataService.fetchCompanyData(bin);

    if (externalCompanyData) {
      // External data found - return with suggestion to import
      return {
        exists: true,
        inSystem: false,
        externalData: {
          bin: externalCompanyData.bin,
          name: externalCompanyData.name,
          fullName: externalCompanyData.fullName,
          industry: externalCompanyData.industry,
          address: externalCompanyData.address,
          legalForm: externalCompanyData.legalForm,
          status: externalCompanyData.status,
          registrationDate: externalCompanyData.registrationDate,
          director: externalCompanyData.director,
          employeeCount: externalCompanyData.employeeCount
        },
        canImport: true,
        message: 'Company found in government registry. You can import this data during onboarding.'
      };
    }

    // No data found anywhere
    return {
      exists: false,
      inSystem: false,
      message: 'Company not found in our system or government registry'
    };
  }

  // 📝 QUERY: Pending Employees
  async pendingEmployees(ownerId: string) {
    const owner = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!owner || owner.role !== UserRole.OWNER) {
      throw new UnauthorizedException('Only owners can view pending employees');
    }

    const organization = await this.organizationRepository.findOne({
      where: { ownerId }
    });

    if (!organization) {
      return [];
    }

    const pendingUsers = await this.userRepository.find({
      where: {
        status: UserStatus.PENDING,
        role: UserRole.EMPLOYEE
      }
    });

    return pendingUsers.filter(user =>
      user.registrationData?.companyBin === organization.bin
    );
  }

  // 📝 COMMAND: Approve Employee
  async approve(ownerId: string, employeeId: string) {
    const owner = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!owner || owner.role !== UserRole.OWNER) {
      throw new UnauthorizedException('Only owners can approve employees');
    }

    const employee = await this.userRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    const organization = await this.organizationRepository.findOne({
      where: { ownerId }
    });

    if (!organization) {
      throw new Error('Owner organization not found');
    }

    employee.organizationId = organization.id;
    employee.status = UserStatus.ACTIVE;

    await this.userRepository.save(employee);

    return {
      success: true,
      message: 'Employee approved successfully',
      employee: {
        id: employee.id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role,
        status: employee.status,
        organizationId: employee.organizationId
      }
    };
  }

  // 📝 COMMAND: Reject Employee
  async reject(ownerId: string, employeeId: string, reason?: string) {
    const owner = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!owner || owner.role !== UserRole.OWNER) {
      throw new UnauthorizedException('Only owners can reject employees');
    }

    const employee = await this.userRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    employee.status = UserStatus.SUSPENDED;
    employee.registrationData = {
      ...employee.registrationData,
      rejectionReason: reason || 'Rejected by owner'
    };

    await this.userRepository.save(employee);

    return {
      success: true,
      message: 'Employee rejected',
      reason
    };
  }

  // 🧪 TEST METHOD: Get verification code for testing (development only)
  async getVerificationCodeForTesting(email: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test methods not available in production');
    }

    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'verificationCode', 'verificationExpiresAt', 'status']
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    return {
      success: true,
      email: user.email,
      verificationCode: user.verificationCode,
      expiresAt: user.verificationExpiresAt,
      status: user.status
    };
  }

  // 🔍 QUERY: Find user by email for onboarding (after email verification)
  async findUserByEmailForOnboarding(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return null;
    }

    // Only return user if they are in onboarding process (email verified but not completed)
    if (!user.emailVerified || user.onboardingStep === OnboardingStep.COMPLETED) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      onboardingStep: user.onboardingStep,
      status: user.status
    };
  }

  // 🔐 SECURITY: HttpOnly Cookie Management Methods
  setAuthCookies(res: any, tokens: { accessToken: string; refreshToken: string }) {
    // Access token cookie - 15 minutes
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });

    // Refresh token cookie - 7 days
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth'
    });
  }

  clearAuthCookies(res: any) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth' });
  }
}