export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly eventId: string;

  constructor(
    public readonly eventType: string,
    public readonly aggregateId: string,
    occurredAt?: Date
  ) {
    this.occurredAt = occurredAt || new Date();
    this.eventId = require('crypto').randomUUID();
  }
}