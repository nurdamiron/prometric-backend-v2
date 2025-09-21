import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/)
  phone?: string;

  // КОМПАНИЯ (опционально - будет создана при onboarding)
  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Company BIN must be 12 digits' })
  companyBin?: string;

  // Только если создается новая компания
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
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