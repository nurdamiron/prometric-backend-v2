import { ValueObject } from '../../../../../shared/domain/base/value-object';

export interface CustomerInfoData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
}

export class CustomerInfo extends ValueObject<CustomerInfoData> {
  constructor(data: CustomerInfoData) {
    if (!data.firstName || data.firstName.trim().length < 2) {
      throw new Error('First name is required and must be at least 2 characters');
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
      throw new Error('Last name is required and must be at least 2 characters');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      throw new Error('Valid email is required');
    }

    if (data.phone && !/^\+?[1-9]\d{1,14}$/.test(data.phone)) {
      throw new Error('Phone number format is invalid');
    }

    super(data);
  }

  public getFullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`.trim();
  }

  public getDisplayName(): string {
    if (this.props.companyName) {
      return `${this.getFullName()} (${this.props.companyName})`;
    }
    return this.getFullName();
  }

  public isBusinessCustomer(): boolean {
    return !!this.props.companyName;
  }

  public getEmail(): string {
    return this.props.email;
  }

  public getPhone(): string | undefined {
    return this.props.phone;
  }

  get value(): CustomerInfoData {
    return this.props;
  }
}