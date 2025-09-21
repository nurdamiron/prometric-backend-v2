import { IsString, IsOptional, IsEnum, IsNumberString } from 'class-validator';
import { plainToClass, Transform } from 'class-transformer';
import { validateSync } from 'class-validator';

export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.DEVELOPMENT;

  @IsNumberString()
  @IsOptional()
  PORT: string = '3333';

  @IsString()
  DATABASE_HOST: string;

  @IsNumberString()
  @IsOptional()
  DATABASE_PORT: string = '5432';

  @IsString()
  DATABASE_USERNAME: string;

  @IsString()
  DATABASE_PASSWORD: string;

  @IsString()
  DATABASE_NAME: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  SMTP_HOST: string;

  @IsNumberString()
  @IsOptional()
  SMTP_PORT: string = '587';

  @IsString()
  SMTP_USER: string;

  @IsString()
  SMTP_PASSWORD: string;

  @IsString()
  SMTP_FROM: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  DATABASE_CA_CERT?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }

  return validatedConfig;
}