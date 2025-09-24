import { DomainEvent } from '../../../../../shared/domain/base/domain-event';
import { CustomerId } from '../value-objects/customer-id.vo';
import { CustomerInfo } from '../value-objects/customer-info.vo';
import { CustomerStatus } from '../value-objects/customer-status.vo';

export class CustomerCreatedEvent extends DomainEvent {
  constructor(
    customerId: CustomerId,
    public readonly organizationId: string,
    public readonly customerInfo: CustomerInfo,
    public readonly initialStatus: CustomerStatus,
    public readonly createdBy: string
  ) {
    super(customerId.value);
  }

  public getEventName(): string {
    return 'CustomerCreated';
  }
}