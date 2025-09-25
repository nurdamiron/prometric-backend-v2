import { DomainEvent } from '../../../../../shared/domain/base/domain-event';

export class UserLoggedInEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    occurredAt?: Date
  ) {
    super('UserLoggedIn', userId, occurredAt);
  }
}