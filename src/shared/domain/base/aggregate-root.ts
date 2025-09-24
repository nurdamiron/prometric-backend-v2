import { Entity } from './entity';
import { DomainEvent } from './domain-event';

export abstract class AggregateRoot extends Entity {
  private _domainEvents: DomainEvent[] = [];

  protected addDomainEvent(domainEvent: DomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  public getUncommittedEvents(): DomainEvent[] {
    return this._domainEvents.slice();
  }

  public markEventsAsCommitted(): void {
    this._domainEvents = [];
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }
}