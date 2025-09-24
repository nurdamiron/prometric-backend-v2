import { DomainEvent } from '../base/domain-event';

export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  organizationId?: string;
  timestamp: Date;
}

export interface EventEnvelope<T extends DomainEvent = DomainEvent> {
  event: T;
  metadata: EventMetadata;
}