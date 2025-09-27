// Department Entity - Simple Domain Entity
import { DepartmentType } from '../value-objects/department-type.vo';

export interface DepartmentDomainProps {
  id: string;
  name: string;
  organizationId: string;
  departmentType: DepartmentType;
  managerId?: string; // User who manages this department
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Department {
  private constructor(private props: DepartmentDomainProps) {}

  public static create(props: Omit<DepartmentDomainProps, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Department {
    return new Department({
      ...props,
      id: crypto.randomUUID(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static reconstitute(props: DepartmentDomainProps): Department {
    return new Department(props);
  }

  // Getters
  public getId(): string {
    return this.props.id;
  }

  public getName(): string {
    return this.props.name;
  }

  public getOrganizationId(): string {
    return this.props.organizationId;
  }

  public getDepartmentType(): DepartmentType {
    return this.props.departmentType;
  }

  public getManagerId(): string | undefined {
    return this.props.managerId;
  }

  public isActive(): boolean {
    return this.props.isActive;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business Logic Methods
  public assignManager(managerId: string): void {
    this.props.managerId = managerId;
    this.props.updatedAt = new Date();
  }

  public removeManager(): void {
    this.props.managerId = undefined;
    this.props.updatedAt = new Date();
  }

  public updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Department name cannot be empty');
    }
    this.props.name = name.trim();
    this.props.updatedAt = new Date();
  }

  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  public activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  public belongsToOrganization(organizationId: string): boolean {
    return this.props.organizationId === organizationId;
  }

  public isManagedBy(userId: string): boolean {
    return this.props.managerId === userId;
  }

  // Equality
  public equals(other: Department): boolean {
    return this.props.id === other.props.id;
  }

  public toJSON(): DepartmentDomainProps {
    return { ...this.props };
  }
}