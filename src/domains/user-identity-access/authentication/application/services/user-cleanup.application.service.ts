import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserCleanupDomainService } from '../../domain/services/user-cleanup.domain.service';

/**
 * Application Service: User Cleanup Orchestration
 * Orchestrates the cleanup process and handles scheduling
 */
@Injectable()
export class UserCleanupApplicationService {
  private readonly logger = new Logger(UserCleanupApplicationService.name);

  constructor(
    private readonly userCleanupDomainService: UserCleanupDomainService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledCleanup() {
    this.logger.log('Starting scheduled user cleanup...');

    try {
      const timeoutSeconds = process.env.NODE_ENV === 'production' ? 2592000 : 30;
      this.logger.log(`Environment: ${process.env.NODE_ENV || 'development'}, Timeout: ${timeoutSeconds}s`);

      const result = await this.userCleanupDomainService.cleanupIncompleteOnboardingUsers(timeoutSeconds);

      if (result.deletedCount > 0) {
        this.logger.warn(`Scheduled cleanup: ${result.deletedCount} users removed`);
      } else {
        this.logger.log('Scheduled cleanup: No users to remove');
      }

    } catch (error) {
      this.logger.error('Scheduled cleanup failed:', error instanceof Error ? error.stack : error);
    }
  }

  async executeCleanup(timeoutSeconds?: number): Promise<{
    success: boolean;
    deletedCount: number;
    deletedUsers: Array<{ email: string; createdAt: Date }>;
  }> {
    const timeout = timeoutSeconds || (process.env.NODE_ENV === 'production' ? 2592000 : 30);
    this.logger.log(`Manual cleanup triggered (timeout: ${timeout}s)`);

    try {
      const result = await this.userCleanupDomainService.cleanupIncompleteOnboardingUsers(timeout);
      this.logger.log(`Manual cleanup completed: ${result.deletedCount} users deleted`);
      return result;
    } catch (error) {
      this.logger.error('Manual cleanup failed:', error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  async getCleanupPreview(timeoutSeconds?: number) {
    const timeout = timeoutSeconds || (process.env.NODE_ENV === 'production' ? 2592000 : 30);

    try {
      const usersToCleanup = await this.userCleanupDomainService.findIncompleteOnboardingUsers(timeout);
      return { usersToCleanup, timeoutUsed: timeout };
    } catch (error) {
      this.logger.error('Failed to get cleanup preview:', error instanceof Error ? error.stack : error);
      throw error;
    }
  }
}