import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, Organization } from '../../auth/entities/user.entity';
import { ConfigureAiAssistantDto, ConfigureAiBrainDto } from '../dto/ai-config.dto';

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,

    private readonly configService: ConfigService,
  ) {}

  // USER AI ASSISTANT METHODS
  async configureUserAssistant(userId: string, config: ConfigureAiAssistantDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const aiConfig = {
      assistantName: config.assistantName,
      personality: config.personality,
      expertise: config.expertise,
      voicePreference: config.voicePreference,
      configuredAt: new Date().toISOString(),
    };

    await this.userRepository.update(userId, { aiConfig });

    return {
      success: true,
      message: 'AI Assistant configured successfully',
      config: aiConfig
    };
  }

  async getUserAssistantConfig(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'firstName', 'lastName', 'aiConfig']
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      aiConfig: user.aiConfig || null,
      hasAssistant: !!user.aiConfig
    };
  }

  // ORGANIZATION AI BRAIN METHODS
  async configureOrganizationBrain(organizationId: string, config: ConfigureAiBrainDto) {
    if (!organizationId) {
      throw new NotFoundException('Organization not found');
    }

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId }
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const aiBrain = {
      personality: config.personality,
      businessGoals: config.businessGoals,
      activeModules: config.activeModules,
      configuredAt: new Date().toISOString(),
    };

    await this.organizationRepository.update(organizationId, { aiBrain });

    return {
      success: true,
      message: 'AI Brain configured successfully',
      config: aiBrain
    };
  }

  async getOrganizationBrainConfig(organizationId: string) {
    if (!organizationId) {
      return { aiBrain: null, hasBrain: false };
    }

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['id', 'name', 'aiBrain']
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      aiBrain: organization.aiBrain || null,
      hasBrain: !!organization.aiBrain
    };
  }

  // AI CAPABILITIES AND CHAT
  async getAvailableCapabilities() {
    return {
      assistantPersonalities: [
        { value: 'professional', label: 'Professional', description: 'Formal and business-focused' },
        { value: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
        { value: 'analytical', label: 'Analytical', description: 'Data-driven and logical' },
        { value: 'creative', label: 'Creative', description: 'Innovative and imaginative' },
        { value: 'supportive', label: 'Supportive', description: 'Encouraging and helpful' }
      ],
      expertiseAreas: [
        'Sales & Marketing',
        'Financial Analysis',
        'Project Management',
        'Customer Service',
        'Data Analytics',
        'Business Strategy',
        'Operations',
        'Human Resources',
        'Technology',
        'Legal & Compliance'
      ],
      voiceOptions: [
        { value: 'male', label: 'Male Voice' },
        { value: 'female', label: 'Female Voice' },
        { value: 'neutral', label: 'Neutral Voice' }
      ],
      brainPersonalities: [
        { value: 'aggressive', label: 'Aggressive Growth', description: 'High-risk, high-reward strategies' },
        { value: 'balanced', label: 'Balanced Approach', description: 'Moderate risk, steady growth' },
        { value: 'conservative', label: 'Conservative', description: 'Low-risk, stable operations' },
        { value: 'innovative', label: 'Innovation-Focused', description: 'Cutting-edge solutions and technologies' }
      ],
      availableModules: [
        'CRM & Sales',
        'Financial Management',
        'Project Tracking',
        'Analytics & Reporting',
        'Customer Support',
        'Marketing Automation',
        'Inventory Management',
        'HR & Payroll',
        'Document Management',
        'Communication Tools'
      ]
    };
  }

  async chatWithUserAssistant(userId: string, message: string, context?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
      select: ['id', 'firstName', 'aiConfig', 'organizationId']
    });

    if (!user || !user.aiConfig) {
      return {
        error: 'AI Assistant not configured',
        message: 'Please configure your AI Assistant first'
      };
    }

    // Temporary fallback to mock response until AI service is properly configured
    return this.generateMockResponse(message, user.aiConfig.assistantName, user.aiConfig.personality);
  }

  private generateMockResponse(message: string, assistantName: string, personality: string): string {
    if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      switch (personality) {
        case 'professional':
          return `Hello! I'm ${assistantName}, your professional AI assistant. How can I help you with your business needs today?`;
        case 'friendly':
          return `Hi there! ${assistantName} here! 😊 What can I do for you today?`;
        case 'analytical':
          return `Greetings. I'm ${assistantName}. I'm ready to analyze your request and provide data-driven insights.`;
        case 'creative':
          return `Hey! ${assistantName} at your service! 🎨 Let's explore some creative solutions together!`;
        case 'supportive':
          return `Hello! I'm ${assistantName}, and I'm here to support you. What would you like to work on?`;
        default:
          return `Hello! I'm ${assistantName}, your professional AI assistant. How can I help you with your business needs today?`;
      }
    }

    return `${assistantName}: I understand you're asking about "${message}". As your ${personality} assistant, I'm here to help. This is a demo response - full AI integration coming soon!`;
  }
}