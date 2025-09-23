import { Controller, Post, Body, Get, UseGuards, Request, Param } from '@nestjs/common';
import { AiService } from '../services/ai.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ConfigureAiAssistantDto, ConfigureAiBrainDto } from '../dto/ai-config.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // USER AI ASSISTANT CONFIGURATION
  @Post('assistant/configure')
  async configureAssistant(@Request() req: any, @Body() configDto: ConfigureAiAssistantDto) {
    return this.aiService.configureUserAssistant(req.user.id, configDto);
  }

  @Get('assistant/config')
  async getAssistantConfig(@Request() req: any) {
    return this.aiService.getUserAssistantConfig(req.user.id);
  }

  // ORGANIZATION AI BRAIN CONFIGURATION
  @Post('brain/configure')
  async configureBrain(@Request() req: any, @Body() configDto: ConfigureAiBrainDto) {
    return this.aiService.configureOrganizationBrain(req.user.organizationId, configDto);
  }

  @Get('brain/config')
  async getBrainConfig(@Request() req: any) {
    return this.aiService.getOrganizationBrainConfig(req.user.organizationId);
  }

  // AI CAPABILITIES
  @Get('capabilities')
  async getAvailableCapabilities() {
    return this.aiService.getAvailableCapabilities();
  }

  @Post('chat')
  async chatWithAssistant(@Request() req: any, @Body() { message }: { message: string }) {
    return this.aiService.chatWithUserAssistant(req.user.id, message);
  }
}