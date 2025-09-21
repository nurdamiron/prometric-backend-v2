import { IsString, IsOptional, IsEnum, IsNotEmpty, Matches, IsBoolean } from 'class-validator';
import { OnboardingStep } from '../entities/user.entity';

export class UpdateOnboardingProgressDto {
  @IsEnum(OnboardingStep)
  @IsNotEmpty()
  onboardingStep: OnboardingStep;

  @IsOptional()
  onboardingData?: OnboardingDataDto;
}

export class CompleteOnboardingDto {
  @IsNotEmpty()
  onboardingData: OnboardingDataDto;
}

export class OnboardingDataDto {
  // Personal Info
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/)
  phone?: string;

  // User Type
  @IsOptional()
  @IsEnum(['owner', 'employee'])
  userType?: 'owner' | 'employee';

  // Company Info (for owners)
  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Company BIN must be 12 digits' })
  companyBin?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  // Theme Selection
  @IsOptional()
  @IsEnum(['light', 'dark'])
  theme?: 'light' | 'dark';

  // Features/Pricing
  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;

  // AI Assistant Configuration
  @IsOptional()
  aiConfig?: {
    assistantName?: string;
    personality?: string;
    expertise?: string[];
    voicePreference?: string;
  };
}