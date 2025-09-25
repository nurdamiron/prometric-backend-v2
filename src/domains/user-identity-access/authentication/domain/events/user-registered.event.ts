import { DomainEvent } from '../../../../../shared/domain/base/domain-event';

export class UserRegisteredEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly verificationCode: string,
    occurredAt?: Date
  ) {
    super('UserRegistered', userId, occurredAt);
  }
}