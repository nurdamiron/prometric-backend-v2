export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly eventVersion: number;
  public readonly eventType: string;
  public readonly aggregateId: string;
  private _isMarkedForDispatch: boolean = false;

  constructor(eventType: string, aggregateId: string, eventVersion: number | Date = 1) {
    this.occurredAt = new Date();
    this.eventVersion = typeof eventVersion === 'number' ? eventVersion : 1;
    this.eventType = eventType;
    this.aggregateId = aggregateId;
  }

  public markForDispatch(): void {
    this._isMarkedForDispatch = true;
  }

  public isMarkedForDispatch(): boolean {
    return this._isMarkedForDispatch;
  }

  public getAggregateId(): string {
    return this.aggregateId;
  }

  public getEventName(): string {
    return this.eventType;
  }
}