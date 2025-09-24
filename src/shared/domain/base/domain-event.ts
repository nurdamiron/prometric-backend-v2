export abstract class DomainEvent {
  public readonly occurredAt: Date;

  protected constructor(
    public readonly aggregateId: string,
    public readonly eventVersion: number = 1
  ) {
    this.occurredAt = new Date();
  }

  public abstract getEventName(): string;
}