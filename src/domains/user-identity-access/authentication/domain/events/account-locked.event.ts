import { DomainEvent } from '../../../../../shared/domain/base/domain-event';

export class AccountLockedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly failedAttempts: number,
    public readonly lockedUntil: Date,
    occurredAt?: Date
  ) {
    super('AccountLocked', userId, occurredAt);
  }
}