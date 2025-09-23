import { IsString, IsArray, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';

export class ConfigureAiAssistantDto {
  @IsString()
  @IsNotEmpty()
  assistantName: string;

  @IsString()
  @IsEnum(['professional', 'friendly', 'analytical', 'creative', 'supportive'])
  personality: string;

  @IsArray()
  @IsString({ each: true })
  expertise: string[];

  @IsString()
  @IsEnum(['male', 'female', 'neutral'])
  voicePreference: string;
}

export class ConfigureAiBrainDto {
  @IsString()
  @IsEnum(['aggressive', 'balanced', 'conservative', 'innovative'])
  personality: string;

  @IsArray()
  @IsString({ each: true })
  businessGoals: string[];

  @IsArray()
  @IsString({ each: true })
  activeModules: string[];
}

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  context?: string;
}