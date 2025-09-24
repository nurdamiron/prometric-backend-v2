import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

// Enhanced XSS protection for server-side
const sanitizeInput = (value: string) => {
  if (!value || typeof value !== 'string') return value;

  return value
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs
    .replace(/data:/gi, '')
    // Remove event handlers
    .replace(/on\w+=/gi, '')
    // Remove expression() CSS
    .replace(/expression\s*\(/gi, '')
    // Remove vbscript:
    .replace(/vbscript:/gi, '')
    // Remove any suspicious protocols
    .replace(/(javascript|data|vbscript|blob|file):/gi, '');
};

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(320)
  email: string;

  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @Transform(({ value }) => sanitizeInput(value?.trim()))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[1-9]\d{1,14}$/)
  phone?: string;

  // КОМПАНИЯ (опционально - будет создана при onboarding)
  @IsOptional()
  @IsString()
  @MaxLength(12)
  @Matches(/^\d{12}$/, { message: 'Company BIN must be 12 digits' })
  companyBin?: string;

  // Только если создается новая компания
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
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  rememberMe?: boolean;
}