import { DomainEvent } from '../../../../../shared/domain/base/domain-event';

export class PasswordChangedEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    occurredAt?: Date
  ) {
    super('PasswordChanged', userId, occurredAt);
  }
}