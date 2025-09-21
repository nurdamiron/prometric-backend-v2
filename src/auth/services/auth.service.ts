import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User, UserRole, UserStatus, Organization, OnboardingStep } from '../entities/user.entity';
import { RegisterDto, LoginDto } from '../dto/register.dto';
import { OnboardingDataDto } from '../dto/onboarding.dto';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    // 1. Check if email exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email }
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // 3. Generate verification code
    const verificationCode = this.emailService.generateVerificationCode();
    const verificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 4. Create user WITHOUT organization (organization will be created later in onboarding)
    const user = this.userRepository.create({
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      password: hashedPassword,
      phone: registerDto.phone,
      role: UserRole.OWNER, // Default role
      status: UserStatus.PENDING, // Pending until email verified
      onboardingStep: OnboardingStep.EMAIL_VERIFICATION,
      verificationCode,
      verificationExpiresAt,
      // organizationId is optional, will be set during onboarding
      aiConfig: undefined // AI setup will be later
    });

    // 5. Save user
    const savedUser = await this.userRepository.save(user);

    // 6. Send verification email
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

    // 7. Return user data with needsVerification flag
    // Generate tokens
    const tokens = await this.generateTokens(savedUser);

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
      ...tokens,
      needsVerification: true
    };
  }

  async login(loginDto: LoginDto) {
    // Find user
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email }
    });

    let organization: Organization | null = null;
    if (user?.organizationId) {
      organization = await this.organizationRepository.findOne({
        where: { id: user.organizationId }
      });
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

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

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub }
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string) {
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
  async updateOnboardingProgress(userId: string, onboardingStep: OnboardingStep, onboardingData?: OnboardingDataDto) {
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

  async completeOnboarding(userId: string, onboardingData: OnboardingDataDto) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      // Mark onboarding as completed
      user.onboardingStep = OnboardingStep.COMPLETED;
      user.status = UserStatus.ACTIVE;
      user.registrationData = {
        ...user.registrationData,
        ...onboardingData
      };

      // If user is owner, create organization
      if (onboardingData.userType === 'owner' && onboardingData.companyName && onboardingData.companyBin) {
        const organization = this.organizationRepository.create({
          name: onboardingData.companyName,
          bin: onboardingData.companyBin,
          industry: onboardingData.industry || 'other',
          ownerId: user.id
        });

        const savedOrganization = await this.organizationRepository.save(organization);
        user.organizationId = savedOrganization.id;
      }

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
      throw new Error('Failed to complete onboarding');
    }
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m'
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d'
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes
    };
  }

  // COMPANY SEARCH METHODS
  async searchCompanyByBin(bin: string) {
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
  async sendVerificationCode(email: string, language: string = 'ru'): Promise<{ success: boolean; message: string }> {
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
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to send verification code'
      };
    }
  }

  async verifyEmailCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
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
        onboardingStep: OnboardingStep.PERSONAL_INFO,
        verificationCode: undefined,
        verificationExpiresAt: undefined
      });

      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Email verification failed'
      };
    }
  }

  // VALIDATION METHODS
  async checkEmailExists(email: string): Promise<boolean> {
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
}