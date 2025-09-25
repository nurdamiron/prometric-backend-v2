import { IsString, IsOptional, IsEnum, IsNotEmpty, Matches, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { OnboardingStep } from '../../domain/entities/user.entity';

// Same sanitization as in register.dto.ts
const sanitizeInput = (value: string) => {
  if (!value || typeof value !== 'string') return value;
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/(javascript|data|vbscript|blob|file):/gi, '');
};

export class OnboardingDataDto {
  // Personal Info
  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @IsOptional()
  @IsString()
  @MaxLength(100)
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
  @MaxLength(12)
  @Matches(/^\d{12}$/, { message: 'Company BIN must be 12 digits' })
  companyBin?: string;

  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @IsOptional()
  @IsString()
  @MaxLength(100)
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

}

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