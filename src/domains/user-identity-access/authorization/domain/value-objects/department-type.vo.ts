// Department Type Value Object - Simple and Clean
export type DepartmentTypeValue = 'sales' | 'marketing' | 'support';

export class DepartmentType {
  private constructor(private readonly value: DepartmentTypeValue) {}

  public static create(value: string): DepartmentType {
    if (!this.isValid(value)) {
      throw new Error(`Invalid department type: ${value}. Must be one of: sales, marketing, support`);
    }
    return new DepartmentType(value as DepartmentTypeValue);
  }

  public static sales(): DepartmentType {
    return new DepartmentType('sales');
  }

  public static marketing(): DepartmentType {
    return new DepartmentType('marketing');
  }

  public static support(): DepartmentType {
    return new DepartmentType('support');
  }

  public getValue(): DepartmentTypeValue {
    return this.value;
  }

  public isSales(): boolean {
    return this.value === 'sales';
  }

  public isMarketing(): boolean {
    return this.value === 'marketing';
  }

  public isSupport(): boolean {
    return this.value === 'support';
  }

  public equals(other: DepartmentType): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    const validTypes: DepartmentTypeValue[] = ['sales', 'marketing', 'support'];
    return validTypes.includes(value as DepartmentTypeValue);
  }
}