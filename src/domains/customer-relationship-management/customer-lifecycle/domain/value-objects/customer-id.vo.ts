import { ValueObject } from '../../../../../shared/domain/base/value-object';
import { v4 as uuidv4 } from 'uuid';

interface CustomerIdProps {
  value: string;
}

export class CustomerId extends ValueObject<CustomerIdProps> {
  constructor(value: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('Customer ID must be a valid UUID');
    }
    super({ value });
  }

  public static generate(): CustomerId {
    return new CustomerId(uuidv4());
  }

  public static fromString(id: string): CustomerId {
    return new CustomerId(id);
  }

  public toString(): string {
    return this.props.value;
  }

  get value(): string {
    return this.props.value;
  }
}