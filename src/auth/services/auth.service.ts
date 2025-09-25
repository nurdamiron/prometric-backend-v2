import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IsNull } from 'typeorm';

import { User, UserRole, UserStatus, Organization, OnboardingStep, RefreshToken } from '../entities/user.entity';
import { RegisterDto, LoginDto } from '../dto/register.dto';
import { OnboardingDataDto } from '../dto/onboarding.dto';
import { EmailService } from './email.service';

// Enhanced XSS sanitization
const sanitizeInput = (value: string) => {
  if (!value || typeof value !== 'string') return value;
  return value
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove URL schemes
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/(javascript|data|vbscript|blob|file):/gi, '')
    // Remove event handlers
    .replace(/on\w+=/gi, '')
    .replace(/expression\s*\(/gi, '')
    // Remove JavaScript functions and methods
    .replace(/\b(alert|confirm|prompt|eval|setTimeout|setInterval|Function|console\.log|console\.error|document\.|window\.|location\.|history\.)\s*\([^)]*\)/gi, '')
    // Remove JavaScript operators in suspicious contexts
    .replace(/[;&|]+/g, '')
    // Remove parentheses that could contain JavaScript
    .replace(/\([^)]*\)/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,

    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    // 🔒 RACE CONDITION FIX: Use transaction with explicit locking
    return await this.userRepository.manager.transaction(async transactionalEntityManager => {
      // 1. Check if email exists with FOR UPDATE lock to prevent race conditions
      const existingUser = await transactionalEntityManager
        .createQueryBuilder(User, 'user')
        .where('user.email = :email', { email: registerDto.email })
        .setLock('pessimistic_write') // Explicit row lock
        .getOne();

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

    // 2. Hash password - optimized cost for production performance
    const saltRounds = process.env.NODE_ENV === 'production' ? 10 : 8; // Reduced from 12
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

      // 3. Generate verification code
      const verificationCode = this.emailService.generateVerificationCode();
      const verificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // 4. Create user WITHOUT role (role will be assigned during onboarding)
      const user = transactionalEntityManager.create(User, {
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        password: hashedPassword,
        phone: registerDto.phone,
        status: UserStatus.PENDING, // Pending until email verified
        onboardingStep: OnboardingStep.EMAIL_VERIFICATION,
        verificationCode,
        verificationExpiresAt,
        // role and organizationId will be set during onboarding
        aiConfig: undefined // AI setup will be later
      });

      // 5. Save user within transaction
      const savedUser = await transactionalEntityManager.save(User, user);

      // 6. Send verification email (async, don't block transaction)
      try {
        await this.emailService.sendVerificationCode(
          savedUser.email,
          verificationCode,
          'ru' // Default to Russian for Kazakhstan users
        );
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue with registration even if email fails
      }

      // 7. NO TOKEN GENERATION - Security requirement!
      // const tokens = await this.generateTokens(savedUser); // REMOVED

      // 8. Return user data WITHOUT tokens until email verified
      return {
        user: {
          id: savedUser.id,
          email: savedUser.email,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          role: savedUser.role,
          status: savedUser.status,
          onboardingStep: savedUser.onboardingStep,
          organization: null, // No organization yet
          aiConfig: savedUser.aiConfig
        },
        message: 'Registration successful. Please verify your email.',
        needsVerification: true
        // ❌ NO TOKENS until email verification completed
      };
    }); // End transaction
  }

  async login(loginDto: LoginDto, requestMetadata?: {
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  }) {
    // Find user
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email }
    });

    // 🔐 SECURITY: Handle non-existent user (prevent user enumeration)
    if (!user) {
      // Simulate password check timing to prevent timing attacks
      await bcrypt.compare('dummy-password', '$2a$12$dummy.hash.to.prevent.timing.attacks');
      throw new UnauthorizedException('Invalid credentials');
    }

    // 🔒 SECURITY: Check account lockout
    if (user.isAccountLocked()) {
      throw new UnauthorizedException(`Account locked until ${user.lockedUntil?.toISOString()}`);
    }

    // 🔑 SECURITY: Validate password (with null check)
    if (!user.password) {
      throw new UnauthorizedException('Invalid account state');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      // ❗ SECURITY: Increment failed attempts
      user.incrementFailedAttempts();
      await this.userRepository.save(user);

      throw new UnauthorizedException('Invalid credentials');
    }

    // 📊 SECURITY: Check user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // 🏢 Load organization data
    let organization: Organization | null = null;
    if (user.organizationId) {
      organization = await this.organizationRepository.findOne({
        where: { id: user.organizationId }
      });
    }

    // 🔄 SECURITY: Update login metadata (with safety checks)
    const ipAddress = requestMetadata?.ipAddress || 'unknown';
    user.updateLoginMetadata(ipAddress);
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user, requestMetadata);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        organization: organization,
        aiConfig: user.aiConfig
      },
      ...tokens
    };
  }

  async refresh(refreshToken: string, requestMetadata?: {
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      // 🔍 VERIFY JWT SIGNATURE
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      });

      // 📊 VERIFY TOKEN IN DATABASE
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const storedToken = await this.refreshTokenRepository.findOne({
        where: { tokenHash, revokedAt: IsNull() }
      });

      if (!storedToken || !storedToken.isValid()) {
        throw new UnauthorizedException('Invalid or revoked refresh token');
      }

      // 👤 VERIFY USER STATUS
      const user = await this.userRepository.findOne({
        where: { id: payload.sub }
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        // 🗑️ Revoke token if user is inactive
        storedToken.revoke('user_inactive');
        await this.refreshTokenRepository.save(storedToken);
        throw new UnauthorizedException('User account is not active');
      }

      // 📊 UPDATE TOKEN USAGE
      storedToken.updateUsage();
      await this.refreshTokenRepository.save(storedToken);

      // 🔄 GENERATE NEW TOKENS
      return this.generateTokens(user, requestMetadata);
    } catch (error) {
      // 🚨 Log security event
      console.error('Refresh token validation failed:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async profile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId }
    });

    let organization: Organization | null = null;
    if (user?.organizationId) {
      organization = await this.organizationRepository.findOne({
        where: { id: user.organizationId }
      });
    }

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
      onboardingStep: user.onboardingStep,
      organizationId: user.organizationId,
      aiConfig: user.aiConfig
    };
  }

  async logout(userId: string) {
    // TODO: Implement token blacklisting if needed
    return { message: 'Logged out successfully' };
  }

  // ONBOARDING PROGRESS METHODS
  async progressOnboarding(userId: string, onboardingStep: OnboardingStep, onboardingData?: OnboardingDataDto) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      // Update onboarding step and save data
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
    } catch (error) {
      console.error('Failed to update onboarding progress:', error);
      throw new Error('Failed to save onboarding progress');
    }
  }

  async finishOnboarding(userId: string, onboardingData: OnboardingDataDto) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      // CRITICAL: Must verify email before completing onboarding
      if (user.onboardingStep === OnboardingStep.EMAIL_VERIFICATION) {
        throw new BadRequestException('Email must be verified before completing onboarding');
      }

      // CRITICAL: Validate userType is provided
      if (!onboardingData.userType) {
        throw new BadRequestException('User type must be specified');
      }

      // Assign role based on userType
      if (onboardingData.userType === 'owner') {
        // CRITICAL: Owner must provide company details
        if (!onboardingData.companyName || !onboardingData.companyBin) {
          throw new BadRequestException('Company name and BIN are required for owners');
        }
        user.role = UserRole.OWNER;
        user.status = UserStatus.ACTIVE;

        // Create organization for owner
        if (onboardingData.companyName && onboardingData.companyBin) {
          // Check if organization with this БИН already exists
          const existingOrg = await this.organizationRepository.findOne({
            where: { bin: onboardingData.companyBin }
          });

          if (existingOrg) {
            throw new BadRequestException(`Organization with БИН ${onboardingData.companyBin} already exists`);
          }

          const organization = this.organizationRepository.create({
            name: sanitizeInput(onboardingData.companyName),
            bin: onboardingData.companyBin,
            industry: sanitizeInput(onboardingData.industry || 'other'),
            ownerId: user.id
          });

          const savedOrganization = await this.organizationRepository.save(organization);
          user.organizationId = savedOrganization.id;
        }
      } else if (onboardingData.userType === 'employee') {
        // CRITICAL: Validate that organization with this BIN exists
        if (!onboardingData.companyBin) {
          throw new BadRequestException('Company BIN is required for employees');
        }

        const existingOrganization = await this.organizationRepository.findOne({
          where: { bin: onboardingData.companyBin }
        });

        if (!existingOrganization) {
          throw new BadRequestException('Organization with this BIN does not exist');
        }

        user.role = UserRole.EMPLOYEE;
        user.status = UserStatus.PENDING; // Pending approval from owner
        // organizationId remains null until owner approval
      }

      // Mark onboarding as completed
      user.onboardingStep = OnboardingStep.COMPLETED;
      user.registrationData = {
        ...user.registrationData,
        ...onboardingData
      };

      await this.userRepository.save(user);

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
          onboardingStep: user.onboardingStep,
          organizationId: user.organizationId
        }
      };
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Re-throw BadRequestException as-is, wrap others
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error('Failed to complete onboarding');
    }
  }


  // COMPANY SEARCH METHODS
  async findCompany(bin: string) {
    try {
      // Find organization by BIN
      const organization = await this.organizationRepository.findOne({
        where: { bin }
      });

      if (organization) {
        // Find owner separately
        const owner = await this.userRepository.findOne({
          where: { id: organization.ownerId }
        });

        return {
          exists: true,
          company: {
            id: organization.id,
            name: organization.name,
            bin: organization.bin,
            industry: organization.industry,
            ownerId: organization.ownerId,
            ownerName: owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown'
          }
        };
      }

      return {
        exists: false,
        message: 'Company with this BIN not found',
        messageRu: 'Компания с таким БИН не найдена',
        messageKk: 'Бұл БСН-мен компания табылмады'
      };
    } catch (error) {
      console.error('Company search failed:', error);
      return {
        exists: false,
        error: 'Search failed',
        errorRu: 'Поиск не удался',
        errorKk: 'Іздеу сәтсіз аяқталды'
      };
    }
  }

  // EMAIL VERIFICATION METHODS
  async sendCode(email: string, language: string = 'ru'): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepository.findOne({ where: { email } });
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new verification code
      const verificationCode = this.emailService.generateVerificationCode();
      const verificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update user with new code
      await this.userRepository.update(user.id, {
        verificationCode,
        verificationExpiresAt,
        onboardingStep: OnboardingStep.EMAIL_VERIFICATION
      });

      // Send email
      await this.emailService.sendVerificationCode(email, verificationCode, language);

      return {
        success: true,
        message: 'Verification code sent successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to send verification code'
      };
    }
  }

  async verifyCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.userRepository.findOne({ where: { email } });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if code is valid and not expired
      if (user.verificationCode !== code) {
        throw new Error('Invalid verification code');
      }

      if (!user.verificationExpiresAt || user.verificationExpiresAt < new Date()) {
        throw new Error('Verification code has expired');
      }

      // Mark email as verified and move to next step
      await this.userRepository.update(user.id, {
        status: UserStatus.ACTIVE,
        onboardingStep: OnboardingStep.THEME,
        verificationCode: undefined,
        verificationExpiresAt: undefined
      });

      // 🔑 GENERATE TOKENS ONLY AFTER EMAIL VERIFICATION
      const updatedUser = await this.userRepository.findOne({ where: { id: user.id } });
      const tokens = await this.generateTokens(updatedUser!);

      return {
        success: true,
        message: 'Email verified successfully',
        ...tokens
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Email verification failed'
      };
    }
  }

  // VALIDATION METHODS
  async emailExists(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { email }
    });

    return !!user;
  }

  async validatePassword(password: string) {
    const checks = {
      minLength: password.length >= 8,
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
    };

    const isValid = Object.values(checks).every(check => check);

    return {
      isValid,
      checks,
      score: Object.values(checks).filter(Boolean).length,
      maxScore: Object.keys(checks).length
    };
  }

  private async generateTokens(user: User, requestMetadata?: {
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  }) {
    const now = Date.now();
    const jti = uuidv4(); // Unique token ID

    // 🎫 ACCESS TOKEN PAYLOAD (minimal for performance)
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(user.organizationId && { organizationId: user.organizationId }), // ✅ Only include if exists
      iat: Math.floor(now / 1000),
      jti: jti + '_access'
    };

    // 🔄 REFRESH TOKEN PAYLOAD (even more minimal)
    const refreshPayload = {
      sub: user.id,
      type: 'refresh',
      iat: Math.floor(now / 1000),
      jti: jti + '_refresh'
    };

    // 🔑 GENERATE TOKENS
    const accessToken = this.jwtService.sign(accessPayload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m'
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d'
    });

    // 💾 STORE REFRESH TOKEN METADATA
    await this.storeRefreshToken(user.id, refreshToken, jti + '_refresh', requestMetadata);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer'
    };
  }

  // 🔐 SET HTTPONLY COOKIES FOR SECURE AUTHENTICATION
  setAuthCookies(res: any, tokens: { accessToken: string; refreshToken: string }) {
    // Access token cookie (15 minutes)
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });

    // Refresh token cookie (7 days)
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth/refresh'
    });
  }

  // 🧹 CLEAR AUTH COOKIES ON LOGOUT
  clearAuthCookies(res: any) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
  }

  // 💾 STORE REFRESH TOKEN WITH METADATA
  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    jti: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
    }
  ) {
    // Hash the refresh token for secure storage
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      jti,
      deviceFingerprint: metadata?.deviceFingerprint,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      usageCount: 0
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);
  }

  // EMPLOYEE APPROVAL METHODS
  async pendingEmployees(ownerId: string) {
    const owner = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!owner || owner.role !== UserRole.OWNER) {
      throw new UnauthorizedException('Only owners can view pending employees');
    }

    // Find employees who registered with this company's BIN but aren't approved yet
    const pendingEmployees = await this.userRepository.find({
      where: {
        role: UserRole.EMPLOYEE,
        status: UserStatus.PENDING
      }
    });

    // Filter by company BIN from registrationData
    const ownerOrganization = await this.organizationRepository.findOne({
      where: { ownerId }
    });

    if (!ownerOrganization) {
      return [];
    }

    return pendingEmployees.filter(employee =>
      employee.registrationData?.companyBin === ownerOrganization.bin
    );
  }

  async approve(ownerId: string, employeeId: string) {
    const owner = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!owner || owner.role !== UserRole.OWNER) {
      throw new UnauthorizedException('Only owners can approve employees');
    }

    const employee = await this.userRepository.findOne({ where: { id: employeeId } });
    if (!employee || employee.role !== UserRole.EMPLOYEE) {
      throw new Error('Employee not found');
    }

    // Get owner's organization
    const organization = await this.organizationRepository.findOne({
      where: { ownerId }
    });

    if (!organization) {
      throw new Error('Owner organization not found');
    }

    // Verify employee registered with correct BIN
    if (employee.registrationData?.companyBin !== organization.bin) {
      throw new Error('Employee BIN does not match organization');
    }

    // Approve employee
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

  async reject(ownerId: string, employeeId: string, reason?: string) {
    const owner = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!owner || owner.role !== UserRole.OWNER) {
      throw new UnauthorizedException('Only owners can reject employees');
    }

    const employee = await this.userRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Reject employee
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
}