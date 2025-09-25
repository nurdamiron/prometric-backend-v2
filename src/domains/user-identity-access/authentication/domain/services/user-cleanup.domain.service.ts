import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus, OnboardingStep } from '../entities/user.entity';

/**
 * Domain Service: User Cleanup
 * Responsible for cleaning up incomplete onboarding users according to business rules
 */
@Injectable()
export class UserCleanupDomainService {
  private readonly logger = new Logger(UserCleanupDomainService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async cleanupIncompleteOnboardingUsers(timeoutSeconds: number): Promise<{
    success: boolean;
    deletedCount: number;
    deletedUsers: Array<{ email: string; createdAt: Date }>;
  }> {
    this.logger.log(`🧹 Starting cleanup of incomplete onboarding users (timeout: ${timeoutSeconds}s)`);

    try {
      const usersToDelete = await this.findIncompleteOnboardingUsers(timeoutSeconds);

      if (usersToDelete.length === 0) {
        this.logger.log('No incomplete onboarding users found for cleanup');
        return {
          success: true,
          deletedCount: 0,
          deletedUsers: []
        };
      }

      this.logger.log(`Found ${usersToDelete.length} users to cleanup`);

      const deleteResult = await this.userRepository
        .createQueryBuilder()
        .delete()
        .from(User)
        .where('status = :status', { status: UserStatus.PENDING })
        .andWhere('onboardingStep != :completedStep', { completedStep: OnboardingStep.COMPLETED })
        .andWhere(`createdAt < NOW() - INTERVAL '${timeoutSeconds} seconds'`)
        .execute();

      const deletedCount = deleteResult.affected || 0;
      this.logger.log(`Cleanup completed: ${deletedCount} users deleted`);

      return {
        success: true,
        deletedCount,
        deletedUsers: usersToDelete.map(user => ({
          email: user.email,
          createdAt: user.createdAt
        }))
      };

    } catch (error) {
      this.logger.error('Cleanup failed:', error instanceof Error ? error.stack : error);
      throw new Error(`User cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findIncompleteOnboardingUsers(timeoutSeconds: number): Promise<Array<{
    id: string;
    email: string;
    onboardingStep: OnboardingStep;
    createdAt: Date;
    ageInHours: number;
  }>> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.onboardingStep', 'user.createdAt'])
      .where('user.status = :status', { status: UserStatus.PENDING })
      .andWhere('user.onboardingStep != :completedStep', { completedStep: OnboardingStep.COMPLETED })
      .andWhere(`user.createdAt < NOW() - INTERVAL '${timeoutSeconds} seconds'`)
      .orderBy('user.createdAt', 'ASC')
      .getMany();

    return users.map(user => ({
      id: user.id,
      email: user.email,
      onboardingStep: user.onboardingStep,
      createdAt: user.createdAt,
      ageInHours: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60))
    }));
  }
}