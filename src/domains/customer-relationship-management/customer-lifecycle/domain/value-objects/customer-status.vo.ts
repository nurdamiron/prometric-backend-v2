import { ValueObject } from '../../../../../shared/domain/base/value-object';

export enum CustomerStatusType {
  LEAD = 'lead',
  PROSPECT = 'prospect',
  QUALIFIED = 'qualified',
  CUSTOMER = 'customer',
  INACTIVE = 'inactive',
  LOST = 'lost'
}

export class CustomerStatus extends ValueObject<CustomerStatusType> {
  protected validate(): void {
    if (!Object.values(CustomerStatusType).includes(this.value)) {
      throw new Error(`Invalid customer status: ${this.value}`);
    }
  }

  public static lead(): CustomerStatus {
    return new CustomerStatus(CustomerStatusType.LEAD);
  }

  public static prospect(): CustomerStatus {
    return new CustomerStatus(CustomerStatusType.PROSPECT);
  }

  public static qualified(): CustomerStatus {
    return new CustomerStatus(CustomerStatusType.QUALIFIED);
  }

  public static customer(): CustomerStatus {
    return new CustomerStatus(CustomerStatusType.CUSTOMER);
  }

  public static inactive(): CustomerStatus {
    return new CustomerStatus(CustomerStatusType.INACTIVE);
  }

  public static lost(): CustomerStatus {
    return new CustomerStatus(CustomerStatusType.LOST);
  }

  public canTransitionTo(newStatus: CustomerStatus): boolean {
    const transitions = this.getAllowedTransitions();
    return transitions.includes(newStatus.value);
  }

  private getAllowedTransitions(): CustomerStatusType[] {
    const transitionRules: Record<CustomerStatusType, CustomerStatusType[]> = {
      [CustomerStatusType.LEAD]: [CustomerStatusType.PROSPECT, CustomerStatusType.QUALIFIED, CustomerStatusType.LOST],
      [CustomerStatusType.PROSPECT]: [CustomerStatusType.QUALIFIED, CustomerStatusType.CUSTOMER, CustomerStatusType.LOST],
      [CustomerStatusType.QUALIFIED]: [CustomerStatusType.CUSTOMER, CustomerStatusType.INACTIVE, CustomerStatusType.LOST],
      [CustomerStatusType.CUSTOMER]: [CustomerStatusType.INACTIVE],
      [CustomerStatusType.INACTIVE]: [CustomerStatusType.CUSTOMER],
      [CustomerStatusType.LOST]: [CustomerStatusType.LEAD] // Can requalify lost customers
    };

    return transitionRules[this.value] || [];
  }

  public isLead(): boolean {
    return this.value === CustomerStatusType.LEAD;
  }

  public isActive(): boolean {
    return [CustomerStatusType.PROSPECT, CustomerStatusType.QUALIFIED, CustomerStatusType.CUSTOMER].includes(this.value);
  }

  public isCustomer(): boolean {
    return this.value === CustomerStatusType.CUSTOMER;
  }

  public isLost(): boolean {
    return this.value === CustomerStatusType.LOST;
  }
}