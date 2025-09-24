import { ValueObject } from '../../../../../shared/domain/base/value-object';

export interface CustomerInfoData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
}

export class CustomerInfo extends ValueObject<CustomerInfoData> {
  protected validate(): void {
    if (!this.value.firstName || this.value.firstName.trim().length < 2) {
      throw new Error('First name is required and must be at least 2 characters');
    }

    if (!this.value.lastName || this.value.lastName.trim().length < 2) {
      throw new Error('Last name is required and must be at least 2 characters');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.value.email || !emailRegex.test(this.value.email)) {
      throw new Error('Valid email is required');
    }

    if (this.value.phone && !/^\+?[1-9]\d{1,14}$/.test(this.value.phone)) {
      throw new Error('Phone number format is invalid');
    }
  }

  public getFullName(): string {
    return `${this.value.firstName} ${this.value.lastName}`.trim();
  }

  public getDisplayName(): string {
    if (this.value.companyName) {
      return `${this.getFullName()} (${this.value.companyName})`;
    }
    return this.getFullName();
  }

  public isBusinessCustomer(): boolean {
    return !!this.value.companyName;
  }

  public getEmail(): string {
    return this.value.email;
  }

  public getPhone(): string | undefined {
    return this.value.phone;
  }
}